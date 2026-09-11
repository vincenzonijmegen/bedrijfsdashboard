"use client";

import { useEffect, useMemo, useState } from "react";

type CashflowLine = {
  streamId: number;
  name: string;
  category: string;
  direction: "in" | "uit";
  amount: number | null;
  vatPart?: number | null;
  source: string;
  netAfterBox2?: number;
  box2Percentage?: number;
};

type CashflowMonth = {
  year: number;
  month: number;
  income: number;
  expenses: number;
  cashChange: number | null;
  beginningBalance: number | null;
  endingBalance: number | null;
  minimumBuffer: number | null;
  belowMinimum: boolean | null;
  missingConfiguration: string[];
  lines: CashflowLine[];
};

type Holding = {
  entity: string;
  available: boolean;
  reason: string | null;
  startDate: string;
  startBalance: number;
  minimumBuffer: number;
  missingConfiguration: string[];
  months: CashflowMonth[];
  lowestBalance: number | null;
  lowestYear: number | null;
  lowestMonth: number | null;
  endingBalance: number | null;
};

type HoldingsResponse = {
  success: boolean;
  fase: string;
  data?: {
    toYear: number;
    available: boolean;
    holdings: Holding[];
  };
  error?: string;
};

type BufferAlert = {
  entity: string;
  year: number;
  month: number;
  minimumBuffer: number;
  endingBalance: number;
  endingBalanceWithoutPrivateWithdrawal: number;
  targetPrivateNet: number;
  holdingCashCost: number;
  bufferShortfall: number;
  type: "opname_breekt_buffer" | "opname_vergroot_buffertekort";
  canAvoidBreachByPostponing: boolean;
  action: "uitstellen";
};

type AlertsResponse = {
  success: boolean;
  fase: string;
  data?: {
    toYear: number;
    available: boolean;
    alerts: BufferAlert[];
    summary: {
      total: number;
      breaksBuffer: number;
      worsensExistingShortfall: number;
      entities: string[];
    };
  };
  error?: string;
};

function euro(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function monthName(month: number) {
  return [
    "",
    "januari",
    "februari",
    "maart",
    "april",
    "mei",
    "juni",
    "juli",
    "augustus",
    "september",
    "oktober",
    "november",
    "december",
  ][month];
}

function cls(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function yearRows(holding: Holding, throughYear: number) {
  const years = Array.from(
    new Set(
      holding.months
        .filter((m) => m.year <= throughYear)
        .map((m) => m.year)
    )
  ).sort((a, b) => a - b);

  return years.map((year) => {
    const months = holding.months.filter((m) => m.year === year);
    const ending = months.find((m) => m.month === 12)?.endingBalance ?? null;
    const balances = months
      .map((m) => m.endingBalance)
      .filter((v): v is number => v != null);
    const lowest = balances.length ? Math.min(...balances) : null;
    const belowMonths = months.filter((m) => m.belowMinimum === true).length;

    return { year, ending, lowest, belowMonths };
  });
}

export default function CashflowHoldingsPage() {
  const [toYear, setToYear] = useState(2029);
  const [holdings, setHoldings] = useState<HoldingsResponse | null>(null);
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [holdingsRes, alertsRes] = await Promise.all([
          fetch(`/api/admin/cashflow/holdings?van=2026&tot=${toYear}`, {
            cache: "no-store",
          }),
          fetch(`/api/admin/cashflow/buffer-waarschuwingen?tot=${toYear}`, {
            cache: "no-store",
          }),
        ]);

        const holdingsJson = (await holdingsRes.json()) as HoldingsResponse;
        const alertsJson = (await alertsRes.json()) as AlertsResponse;

        if (!holdingsRes.ok || !holdingsJson.success) {
          throw new Error(
            holdingsJson.error || `Holdings laden mislukt (${holdingsRes.status})`
          );
        }

        if (!alertsRes.ok || !alertsJson.success) {
          throw new Error(
            alertsJson.error ||
              `Bufferwaarschuwingen laden mislukt (${alertsRes.status})`
          );
        }

        if (!cancelled) {
          setHoldings(holdingsJson);
          setAlerts(alertsJson);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Cashflow laden mislukt"
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [toYear, reloadKey]);

  const alertGroups = useMemo(() => {
    const list = alerts?.data?.alerts ?? [];
    return list.reduce<Record<string, BufferAlert[]>>((acc, alert) => {
      (acc[alert.entity] ||= []).push(alert);
      return acc;
    }, {});
  }, [alerts]);

  const allAvailable =
    holdings?.data?.available === true && alerts?.data?.available === true;

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                Cashflow · fase 4J-A
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                Holdings & bufferbewaking
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Meerjarenoverzicht van Rekka Holding B.V. en Eetje Pans Holding
                B.V., inclusief minimumkasbuffer en waarschuwingen rond geplande
                privé-opnames.
              </p>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <label className="text-sm font-medium text-slate-700">
                Prognose t/m
                <select
                  value={toYear}
                  onChange={(e) => setToYear(Number(e.target.value))}
                  className="ml-2 h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm"
                >
                  {[2028, 2029, 2030, 2031, 2032].map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                onClick={() => setReloadKey((v) => v + 1)}
                disabled={loading}
                className="h-10 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                Ververs
              </button>
            </div>
          </div>
        </section>

        {loading && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            Cashflow wordt geladen…
          </section>
        )}

        {!loading && error && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 shadow-sm">
            <div className="font-semibold">Cashflow kon niet worden geladen.</div>
            <div className="mt-1">{error}</div>
          </section>
        )}

        {!loading && !error && holdings?.data && alerts?.data && (
          <>
            <section
              className={cls(
                "rounded-2xl border p-4 shadow-sm",
                allAvailable
                  ? "border-emerald-200 bg-emerald-50"
                  : "border-amber-200 bg-amber-50"
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div
                    className={cls(
                      "font-semibold",
                      allAvailable ? "text-emerald-900" : "text-amber-900"
                    )}
                  >
                    {allAvailable
                      ? "Berekening volledig beschikbaar"
                      : "Berekening niet volledig beschikbaar"}
                  </div>
                  <div
                    className={cls(
                      "mt-1 text-sm",
                      allAvailable ? "text-emerald-700" : "text-amber-700"
                    )}
                  >
                    Prognose loopt tot en met {toYear}.
                  </div>
                </div>

                <div className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-700 ring-1 ring-slate-200">
                  {alerts.data.summary.total} bufferwaarschuwing
                  {alerts.data.summary.total === 1 ? "" : "en"}
                </div>
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              {holdings.data.holdings.map((holding) => {
                const rows = yearRows(holding, toYear);
                const holdingAlerts = alertGroups[holding.entity] ?? [];
                const below = (holding.lowestBalance ?? 0) < holding.minimumBuffer;

                return (
                  <article
                    key={holding.entity}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div className="border-b border-slate-200 p-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="text-xl font-bold text-slate-900">
                            {holding.entity}
                          </h2>
                          <p className="mt-1 text-sm text-slate-500">
                            Minimum buffer {euro(holding.minimumBuffer)}
                          </p>
                        </div>
                        <span
                          className={cls(
                            "rounded-full px-3 py-1 text-xs font-bold",
                            holding.available
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-red-100 text-red-800"
                          )}
                        >
                          {holding.available ? "Beschikbaar" : "Onvolledig"}
                        </span>
                      </div>

                      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <Stat
                          label="Laagste saldo"
                          value={euro(holding.lowestBalance)}
                          sub={
                            holding.lowestYear && holding.lowestMonth
                              ? `${monthName(holding.lowestMonth)} ${holding.lowestYear}`
                              : "—"
                          }
                          warning={below}
                        />
                        <Stat
                          label={`Eindsaldo ${toYear}`}
                          value={euro(holding.endingBalance)}
                          sub="prognose"
                          warning={
                            holding.endingBalance != null &&
                            holding.endingBalance < holding.minimumBuffer
                          }
                        />
                        <Stat
                          label="Waarschuwingen"
                          value={String(holdingAlerts.length)}
                          sub="privé-opnames"
                          warning={holdingAlerts.length > 0}
                        />
                      </div>
                    </div>

                    <div className="p-5">
                      <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                        Per jaar
                      </h3>
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full min-w-[520px] text-sm">
                          <thead>
                            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                              <th className="pb-2 pr-3">Jaar</th>
                              <th className="pb-2 pr-3 text-right">
                                Laagste saldo
                              </th>
                              <th className="pb-2 pr-3 text-right">
                                Eindsaldo
                              </th>
                              <th className="pb-2 text-right">
                                Mnd. onder buffer
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((row) => (
                              <tr
                                key={row.year}
                                className="border-b border-slate-100 last:border-0"
                              >
                                <td className="py-2.5 pr-3 font-semibold text-slate-800">
                                  {row.year}
                                </td>
                                <td
                                  className={cls(
                                    "py-2.5 pr-3 text-right tabular-nums",
                                    row.lowest != null &&
                                      row.lowest < holding.minimumBuffer
                                      ? "font-semibold text-red-700"
                                      : "text-slate-700"
                                  )}
                                >
                                  {euro(row.lowest)}
                                </td>
                                <td
                                  className={cls(
                                    "py-2.5 pr-3 text-right tabular-nums",
                                    row.ending != null &&
                                      row.ending < holding.minimumBuffer
                                      ? "font-semibold text-red-700"
                                      : "text-slate-700"
                                  )}
                                >
                                  {euro(row.ending)}
                                </td>
                                <td
                                  className={cls(
                                    "py-2.5 text-right tabular-nums",
                                    row.belowMonths > 0
                                      ? "font-semibold text-red-700"
                                      : "text-slate-700"
                                  )}
                                >
                                  {row.belowMonths}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Bufferwaarschuwingen
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Alleen maanden waarin een geplande privé-opname samenvalt
                    met een saldo onder de minimumkasbuffer.
                  </p>
                </div>

                <div className="flex gap-2 text-xs font-semibold">
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-amber-800">
                    {alerts.data.summary.breaksBuffer} door opname
                  </span>
                  <span className="rounded-full bg-red-100 px-3 py-1 text-red-800">
                    {alerts.data.summary.worsensExistingShortfall} vergroot tekort
                  </span>
                </div>
              </div>

              {alerts.data.alerts.length === 0 ? (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  Geen bufferwaarschuwingen binnen deze prognoseperiode.
                </div>
              ) : (
                <div className="mt-4 grid gap-3">
                  {alerts.data.alerts.map((alert) => (
                    <div
                      key={`${alert.entity}-${alert.year}-${alert.month}`}
                      className={cls(
                        "rounded-xl border p-4",
                        alert.canAvoidBreachByPostponing
                          ? "border-amber-200 bg-amber-50"
                          : "border-red-200 bg-red-50"
                      )}
                    >
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="font-semibold text-slate-900">
                            {alert.entity} · {monthName(alert.month)} {alert.year}
                          </div>
                          <div
                            className={cls(
                              "mt-1 text-sm",
                              alert.canAvoidBreachByPostponing
                                ? "text-amber-800"
                                : "text-red-800"
                            )}
                          >
                            {alert.canAvoidBreachByPostponing
                              ? "Deze privé-opname brengt de holding onder de buffer. Uitstellen voorkomt het tekort op dat moment."
                              : "De holding blijft ook zonder deze privé-opname onder de buffer. Uitstellen vermindert het tekort, maar lost het niet volledig op."}
                          </div>
                        </div>

                        <span
                          className={cls(
                            "w-fit rounded-full px-3 py-1 text-xs font-bold",
                            alert.canAvoidBreachByPostponing
                              ? "bg-amber-200 text-amber-900"
                              : "bg-red-200 text-red-900"
                          )}
                        >
                          Advies: uitstellen
                        </span>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">
                        <MiniStat
                          label="Privé netto doel"
                          value={euro(alert.targetPrivateNet)}
                        />
                        <MiniStat
                          label="Kasuitstroom holding"
                          value={euro(alert.holdingCashCost)}
                        />
                        <MiniStat
                          label="Saldo na opname"
                          value={euro(alert.endingBalance)}
                        />
                        <MiniStat
                          label="Saldo zonder opname"
                          value={euro(
                            alert.endingBalanceWithoutPrivateWithdrawal
                          )}
                        />
                        <MiniStat
                          label="Tekort t.o.v. buffer"
                          value={euro(alert.bufferShortfall)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Stat({
  label,
  value,
  sub,
  warning,
}: {
  label: string;
  value: string;
  sub: string;
  warning?: boolean;
}) {
  return (
    <div
      className={cls(
        "rounded-xl border p-3",
        warning
          ? "border-red-200 bg-red-50"
          : "border-slate-200 bg-slate-50"
      )}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div
        className={cls(
          "mt-1 text-lg font-bold tabular-nums",
          warning ? "text-red-800" : "text-slate-900"
        )}
      >
        {value}
      </div>
      <div className="mt-0.5 text-xs text-slate-500">{sub}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-white/80 p-3 ring-1 ring-slate-200">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-sm font-bold tabular-nums text-slate-900">
        {value}
      </div>
    </div>
  );
}
