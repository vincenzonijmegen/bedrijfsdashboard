"use client";

import { useEffect, useMemo, useState } from "react";

type VincenzoYear = {
  jaar: number;
  compleet?: boolean;
  beginsaldo?: number | null;
  eindsaldo?: number | null;
  laagsteSaldo?: number | null;
  laagsteMaand?: number | null;
  minimumKasbuffer?: number | null;
};

type VincenzoResponse = {
  success?: boolean;
  fase?: string;
  data?: {
    vanafJaar?: number;
    totJaar?: number;
    beschikbaar: boolean;
    reden?: string | null;
    instellingen?: {
      minimumKasbuffer?: number;
      omzetGroeiPct?: number;
      loonkostenGroeiPct?: number;
    };
    basisjaar?: {
      jaar: number;
      startsaldo?: number | null;
      eindsaldo?: number | null;
      laagsteSaldo?: number | null;
      laagsteMaand?: number | null;
    };
    jaren?: VincenzoYear[];
    waarschuwingen?: string[];
  };
  error?: string;
};

type Holding = {
  entity: string;
  available: boolean;
  startBalance: number;
  minimumBuffer: number;
  lowestBalance: number | null;
  lowestYear: number | null;
  lowestMonth: number | null;
  endingBalance: number | null;
  missingConfiguration: string[];
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
};

type AlertsResponse = {
  success: boolean;
  data?: {
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

type PlanningOccurrence = {
  entity: string;
  streamId: number;
  streamName: string;
  originalDate: string;
  plannedDate: string;
  amount: number;
  status: string;
  postponed: boolean;
  manual: boolean;
};

type PlanningResponse = {
  success: boolean;
  data?: {
    occurrences: PlanningOccurrence[];
    summary: {
      total: number;
      postponed: number;
      paid: number;
      cancelled: number;
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

function monthName(month: number | null | undefined) {
  if (!month) return "—";
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

function formatPeriod(year: number | null | undefined, month: number | null | undefined) {
  if (!year || !month) return "—";
  return `${monthName(month)} ${year}`;
}

export default function CashflowDashboardPage() {
  const [toYear, setToYear] = useState(2029);
  const [vincenzo, setVincenzo] = useState<VincenzoResponse | null>(null);
  const [holdings, setHoldings] = useState<HoldingsResponse | null>(null);
  const [alerts, setAlerts] = useState<AlertsResponse | null>(null);
  const [planning, setPlanning] = useState<PlanningResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      try {
        const [vRes, hRes, aRes, pRes] = await Promise.all([
          fetch(`/api/admin/cashflow/meerjaren?tot=${toYear}`, {
            cache: "no-store",
          }),
          fetch(`/api/admin/cashflow/holdings?van=2026&tot=${toYear}`, {
            cache: "no-store",
          }),
          fetch(`/api/admin/cashflow/buffer-waarschuwingen?tot=${toYear}`, {
            cache: "no-store",
          }),
          fetch(`/api/admin/cashflow/planning?tot=${toYear}`, {
            cache: "no-store",
          }),
        ]);

        const vJson = (await vRes.json()) as VincenzoResponse;
        const hJson = (await hRes.json()) as HoldingsResponse;
        const aJson = (await aRes.json()) as AlertsResponse;
        const pJson = (await pRes.json()) as PlanningResponse;

        if (!vRes.ok || vJson.success === false || !vJson.data) {
          throw new Error(
            vJson.error || `Vincenzo-prognose laden mislukt (${vRes.status})`
          );
        }
        if (!hRes.ok || !hJson.success || !hJson.data) {
          throw new Error(
            hJson.error || `Holdings laden mislukt (${hRes.status})`
          );
        }
        if (!aRes.ok || !aJson.success || !aJson.data) {
          throw new Error(
            aJson.error ||
              `Bufferwaarschuwingen laden mislukt (${aRes.status})`
          );
        }
        if (!pRes.ok || !pJson.success || !pJson.data) {
          throw new Error(
            pJson.error || `Planning laden mislukt (${pRes.status})`
          );
        }

        if (!cancelled) {
          setVincenzo(vJson);
          setHoldings(hJson);
          setAlerts(aJson);
          setPlanning(pJson);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Cashflowdashboard laden mislukt."
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

  const activePostponements = useMemo(
    () =>
      (planning?.data?.occurrences ?? []).filter(
        (occurrence) => occurrence.postponed && occurrence.status !== "betaald"
      ),
    [planning]
  );

  const vincenzoRows = useMemo(() => {
    const data = vincenzo?.data;
    if (!data) return [];

    const rows: Array<{
      year: number;
      ending: number | null;
      lowest: number | null;
      lowestMonth: number | null;
      minimumBuffer: number | null;
      complete: boolean;
    }> = [];

    if (data.basisjaar) {
      rows.push({
        year: data.basisjaar.jaar,
        ending: data.basisjaar.eindsaldo ?? null,
        lowest: data.basisjaar.laagsteSaldo ?? null,
        lowestMonth: data.basisjaar.laagsteMaand ?? null,
        minimumBuffer: data.instellingen?.minimumKasbuffer ?? null,
        complete: true,
      });
    }

    for (const year of data.jaren ?? []) {
      rows.push({
        year: year.jaar,
        ending: year.eindsaldo ?? null,
        lowest: year.laagsteSaldo ?? null,
        lowestMonth: year.laagsteMaand ?? null,
        minimumBuffer:
          year.minimumKasbuffer ??
          data.instellingen?.minimumKasbuffer ??
          null,
        complete: year.compleet !== false,
      });
    }

    return rows.filter((row) => row.year <= toYear);
  }, [vincenzo, toYear]);

  const lastVincenzo = vincenzoRows.at(-1) ?? null;
  const lowestVincenzo = useMemo(() => {
    return vincenzoRows
      .filter((row) => row.lowest != null)
      .reduce<(typeof vincenzoRows)[number] | null>(
        (lowest, row) =>
          !lowest || Number(row.lowest) < Number(lowest.lowest) ? row : lowest,
        null
      );
  }, [vincenzoRows]);

  const allAvailable =
    vincenzo?.data?.beschikbaar === true &&
    holdings?.data?.available === true &&
    alerts?.data?.available === true;

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                Cashflow · fase 4K-A / 4K-B1 / 4K-B2 / 4K-B3
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                Cashflowdashboard
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Eén overzicht voor IJssalon Vincenzo B.V., Rekka Holding B.V.
                en Eetje Pans Holding B.V. De basisprognose en scenario&apos;s
                blijven bewust van elkaar gescheiden.
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
                onClick={() => setReloadKey((value) => value + 1)}
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
            Dashboard wordt geladen…
          </section>
        )}

        {!loading && error && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 shadow-sm">
            <div className="font-semibold">Dashboard kon niet worden geladen.</div>
            <div className="mt-1">{error}</div>
          </section>
        )}

        {!loading &&
          !error &&
          vincenzo?.data &&
          holdings?.data &&
          alerts?.data &&
          planning?.data && (
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
                        ? "Alle drie entiteiten zijn volledig doorgerekend"
                        : "Een of meer berekeningen zijn niet volledig beschikbaar"}
                    </div>
                    <div
                      className={cls(
                        "mt-1 text-sm",
                        allAvailable ? "text-emerald-700" : "text-amber-700"
                      )}
                    >
                      Basisprognose t/m {toYear}.
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge>
                      {alerts.data.summary.total} bufferwaarschuwing
                      {alerts.data.summary.total === 1 ? "" : "en"}
                    </Badge>
                    <Badge>
                      {activePostponements.length} uitgestelde opname
                      {activePostponements.length === 1 ? "" : "s"}
                    </Badge>
                  </div>
                </div>
              </section>

              <section className="grid gap-5 xl:grid-cols-3">
                <EntityCard
                  title="IJssalon Vincenzo B.V."
                  subtitle={`Minimum buffer ${euro(
                    vincenzo.data.instellingen?.minimumKasbuffer
                  )}`}
                  available={vincenzo.data.beschikbaar}
                  lowest={lowestVincenzo?.lowest ?? null}
                  lowestPeriod={
                    lowestVincenzo
                      ? formatPeriod(
                          lowestVincenzo.year,
                          lowestVincenzo.lowestMonth
                        )
                      : "—"
                  }
                  ending={lastVincenzo?.ending ?? null}
                  endingYear={lastVincenzo?.year ?? toYear}
                  minimumBuffer={
                    vincenzo.data.instellingen?.minimumKasbuffer ?? null
                  }
                  href="#vincenzo"
                  linkLabel="Bekijk jaaroverzicht"
                />

                {holdings.data.holdings.map((holding) => (
                  <EntityCard
                    key={holding.entity}
                    title={holding.entity}
                    subtitle={`Minimum buffer ${euro(holding.minimumBuffer)}`}
                    available={holding.available}
                    lowest={holding.lowestBalance}
                    lowestPeriod={formatPeriod(
                      holding.lowestYear,
                      holding.lowestMonth
                    )}
                    ending={holding.endingBalance}
                    endingYear={toYear}
                    minimumBuffer={holding.minimumBuffer}
                    href="/admin/cashflow/holdings"
                    linkLabel="Open holdings & planning"
                  />
                ))}
              </section>

              <section
                id="vincenzo"
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      IJssalon Vincenzo B.V. · per jaar
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Basisprognose zonder tijdelijke scenario&apos;s.
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2 text-xs font-semibold">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                      Omzetgroei{" "}
                      {vincenzo.data.instellingen?.omzetGroeiPct ?? "—"}%
                    </span>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-700">
                      Loonkostengroei{" "}
                      {vincenzo.data.instellingen?.loonkostenGroeiPct ?? "—"}%
                    </span>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[650px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="pb-2 pr-4">Jaar</th>
                        <th className="pb-2 pr-4 text-right">Laagste saldo</th>
                        <th className="pb-2 pr-4">Moment</th>
                        <th className="pb-2 pr-4 text-right">Eindsaldo</th>
                        <th className="pb-2 text-right">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vincenzoRows.map((row) => {
                        const below =
                          row.lowest != null &&
                          row.minimumBuffer != null &&
                          row.lowest < row.minimumBuffer;

                        return (
                          <tr
                            key={row.year}
                            className="border-b border-slate-100 last:border-0"
                          >
                            <td className="py-3 pr-4 font-semibold text-slate-900">
                              {row.year}
                            </td>
                            <td
                              className={cls(
                                "py-3 pr-4 text-right font-semibold tabular-nums",
                                below ? "text-red-700" : "text-slate-800"
                              )}
                            >
                              {euro(row.lowest)}
                            </td>
                            <td className="py-3 pr-4 text-slate-600">
                              {formatPeriod(row.year, row.lowestMonth)}
                            </td>
                            <td
                              className={cls(
                                "py-3 pr-4 text-right font-semibold tabular-nums",
                                row.ending != null &&
                                  row.minimumBuffer != null &&
                                  row.ending < row.minimumBuffer
                                  ? "text-red-700"
                                  : "text-slate-800"
                              )}
                            >
                              {euro(row.ending)}
                            </td>
                            <td className="py-3 text-right">
                              <span
                                className={cls(
                                  "rounded-full px-2.5 py-1 text-xs font-bold",
                                  row.complete && !below
                                    ? "bg-emerald-100 text-emerald-800"
                                    : row.complete
                                      ? "bg-red-100 text-red-800"
                                      : "bg-amber-100 text-amber-800"
                                )}
                              >
                                {!row.complete
                                  ? "Onvolledig"
                                  : below
                                    ? "Onder buffer"
                                    : "OK"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="grid gap-5 lg:grid-cols-2">
                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-xl font-bold text-slate-900">
                    Acties & planning
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Werk met de echte basisplanning.
                  </p>

                  <div className="mt-4 grid gap-3">
                    <NavCard
                      href="/admin/cashflow/holdings"
                      title="Holdings & bufferbewaking"
                      text={`${alerts.data.summary.total} waarschuwingen · ${activePostponements.length} actieve uitgestelde opnames`}
                    />
                    <NavCard
                      href="/admin/cashflow/instellingen"
                      title="Basisinstellingen"
                      text="Minimum buffers en groeipercentages beheren."
                    />
                    <NavCard
                      href="/admin/cashflow/tarieven"
                      title="Vaste tarieven"
                      text="Bedragen en ingangsdatums van vaste geldstromen beheren."
                    />
                    <NavCard
                      href="/admin/cashflow/incidenteel"
                      title="Incidentele kasstromen"
                      text="Alleen bijzondere of materiële eenmalige posten beheren."
                    />
                  </div>
                </article>

                <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="text-xl font-bold text-slate-900">
                    Scenario&apos;s
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Rekenen zonder de basisprognose te wijzigen.
                  </p>

                  <div className="mt-4 grid gap-3">
                    <NavCard
                      href="/admin/cashflow/scenario-emo-2027"
                      title="Emo 2027"
                      text="Startmaand, uren en afwijkend salaris doorrekenen."
                    />
                    <NavCard
                      href="/admin/cashflow/scenario-eindejaarsbonus"
                      title="Eindejaarsbonus"
                      text="Optionele bruto bonus voor Robert en/of Emo."
                    />
                  </div>
                </article>
              </section>
            </>
          )}
      </div>
    </main>
  );
}

function EntityCard({
  title,
  subtitle,
  available,
  lowest,
  lowestPeriod,
  ending,
  endingYear,
  minimumBuffer,
  href,
  linkLabel,
}: {
  title: string;
  subtitle: string;
  available: boolean;
  lowest: number | null;
  lowestPeriod: string;
  ending: number | null;
  endingYear: number;
  minimumBuffer: number | null;
  href: string;
  linkLabel: string;
}) {
  const lowestWarning =
    lowest != null && minimumBuffer != null && lowest < minimumBuffer;
  const endingWarning =
    ending != null && minimumBuffer != null && ending < minimumBuffer;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
          </div>
          <span
            className={cls(
              "rounded-full px-3 py-1 text-xs font-bold",
              available
                ? "bg-emerald-100 text-emerald-800"
                : "bg-red-100 text-red-800"
            )}
          >
            {available ? "Beschikbaar" : "Onvolledig"}
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
          <Stat
            label="Laagste saldo"
            value={euro(lowest)}
            sub={lowestPeriod}
            warning={lowestWarning}
          />
          <Stat
            label={`Eindsaldo ${endingYear}`}
            value={euro(ending)}
            sub="basisprognose"
            warning={endingWarning}
          />
        </div>
      </div>

      <a
        href={href}
        className="block border-t border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-blue-700 hover:bg-slate-100"
      >
        {linkLabel} →
      </a>
    </article>
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
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
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

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-700 ring-1 ring-slate-200">
      {children}
    </span>
  );
}

function NavCard({
  href,
  title,
  text,
}: {
  href: string;
  title: string;
  text: string;
}) {
  return (
    <a
      href={href}
      className="rounded-xl border border-slate-200 bg-slate-50 p-4 hover:border-blue-200 hover:bg-blue-50"
    >
      <div className="font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-sm text-slate-500">{text}</div>
    </a>
  );
}
