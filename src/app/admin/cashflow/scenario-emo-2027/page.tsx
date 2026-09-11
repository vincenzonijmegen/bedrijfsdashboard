"use client";

import { FormEvent, useMemo, useState } from "react";

type ScenarioLine = {
  streamId: number;
  name: string;
  category: string;
  direction: "in" | "uit";
  amount: number;
  vatPart: number;
  source: string;
};

type AffectedMonth = {
  year: number;
  month: number;
  incomeDelta: number;
  expenseDelta: number;
  reasons: string[];
  endingBalance: number;
  belowMinimum: boolean;
  lines: ScenarioLine[];
};

type ScenarioResponse = {
  success: boolean;
  fase: string;
  data?: {
    available: boolean;
    scenario: string;
    input: {
      start: string;
      hoursPerWeek: number | null;
      grossMonthly: number;
      netMonthly: number;
      payrollReturnMonthly: number;
    };
    rules: {
      endsOn: string;
      managementFeeIncreaseExVatMonthly: number;
      managementFeeIncreaseInclVatMonthly: number;
      vatPercentage: number;
      payrollReturnPaidOneMonthLater: boolean;
      fixed2028BaseRemainsUntouched: boolean;
    };
    totals2027Scenario: {
      salaryMonths: number;
      extraManagementFeeExVatTotal: number;
      extraManagementFeeCashTotal: number;
      extraVatTotal: number;
      totalNetSalary: number;
      totalPayrollReturn: number;
    };
    rekka: {
      baselineEnd2027: number;
      scenarioEnd2027: number;
      scenarioLowestBalance: number;
      scenarioLowestYear: number;
      scenarioLowestMonth: number;
      scenarioEndingBalance: number;
    };
    validation: {
      isRobertEquivalentTest: boolean;
      eetjePansEnd2027: number;
      rekkaScenarioMatchesEetjePansEnd2027: boolean | null;
    };
    affectedMonths: AffectedMonth[];
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

function asNumber(value: string) {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export default function ScenarioEmo2027Page() {
  const [start, setStart] = useState("");
  const [hours, setHours] = useState("");
  const [gross, setGross] = useState("");
  const [net, setNet] = useState("");
  const [payrollReturn, setPayrollReturn] = useState("");
  const [toYear, setToYear] = useState(2029);

  const [result, setResult] = useState<ScenarioResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid =
    /^2027-(0[1-9]|1[0-2])$/.test(start) &&
    Number.isFinite(asNumber(gross)) &&
    asNumber(gross) > 0 &&
    asNumber(gross) <= 3000 &&
    Number.isFinite(asNumber(net)) &&
    asNumber(net) > 0 &&
    Number.isFinite(asNumber(payrollReturn)) &&
    asNumber(payrollReturn) > 0;

  const balanceDelta2027 = useMemo(() => {
    if (!result?.data) return null;
    return (
      result.data.rekka.scenarioEnd2027 -
      result.data.rekka.baselineEnd2027
    );
  }, [result]);

  async function runScenario(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const params = new URLSearchParams({
        start,
        bruto: String(asNumber(gross)),
        netto: String(asNumber(net)),
        loonaangifte: String(asNumber(payrollReturn)),
        tot: String(toYear),
      });

      if (hours.trim() !== "") {
        const parsedHours = asNumber(hours);
        if (!Number.isFinite(parsedHours) || parsedHours < 0) {
          throw new Error("Uren per week is ongeldig.");
        }
        params.set("uren", String(parsedHours));
      }

      const res = await fetch(
        `/api/admin/cashflow/scenario-emo-2027?${params.toString()}`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as ScenarioResponse;

      if (!res.ok || !json.success) {
        throw new Error(json.error || `Scenario laden mislukt (${res.status})`);
      }

      if (!json.data?.available) {
        throw new Error("De basisberekening van de holdings is niet volledig beschikbaar.");
      }

      setResult(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scenario berekenen mislukt.");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setStart("");
    setHours("");
    setGross("");
    setNet("");
    setPayrollReturn("");
    setResult(null);
    setError(null);
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                Cashflow · fase 4J-B1
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                Scenario Emo 2027
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Reken een mogelijke instap van Emo in 2027 door zonder de
                basisprognose te wijzigen. Vanaf 2028 blijft de vaste,
                reeds ingerichte situatie gelden.
              </p>
            </div>

            <a
              href="/admin/cashflow/holdings"
              className="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Terug naar holdings
            </a>
          </div>
        </section>

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 shadow-sm">
          <span className="font-semibold">Alleen scenario.</span>{" "}
          Deze invoer wordt niet opgeslagen en verandert geen tarieven,
          salarissen of managementfees in de basisprognose.
        </section>

        <form
          onSubmit={runScenario}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <h2 className="text-xl font-bold text-slate-900">Invoer</h2>
          <p className="mt-1 text-sm text-slate-500">
            Gebruik voor netto loon en loonaangifte de bedragen uit een
            loonberekening of pro-forma.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Startmaand *">
              <input
                type="month"
                min="2027-01"
                max="2027-12"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </Field>

            <Field label="Uren per week">
              <input
                type="number"
                min="0"
                step="0.25"
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                placeholder="optioneel"
                className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </Field>

            <Field label="Prognose t/m">
              <select
                value={toYear}
                onChange={(e) => setToYear(Number(e.target.value))}
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              >
                {[2028, 2029, 2030, 2031, 2032].map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Bruto loon per maand *" hint="max. € 3.000 in 2027">
              <MoneyInput value={gross} onChange={setGross} />
            </Field>

            <Field label="Netto loon per maand *">
              <MoneyInput value={net} onChange={setNet} />
            </Field>

            <Field label="Loonaangifte per maand *" hint="betaling één maand later">
              <MoneyInput value={payrollReturn} onChange={setPayrollReturn} />
            </Field>
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={!valid || loading}
              className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "Berekenen…" : "Bereken scenario"}
            </button>

            <button
              type="button"
              onClick={resetForm}
              className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Wis invoer
            </button>
          </div>
        </form>

        {error && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800 shadow-sm">
            <div className="font-semibold">Scenario kon niet worden berekend.</div>
            <div className="mt-1">{error}</div>
          </section>
        )}

        {result?.data && (
          <>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    Uitkomst 2027
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Start {result.data.input.start} ·{" "}
                    {result.data.totals2027Scenario.salaryMonths} salarismaanden
                    {result.data.input.hoursPerWeek != null
                      ? ` · ${result.data.input.hoursPerWeek} uur/week`
                      : ""}
                  </p>
                </div>

                <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800">
                  Niet opgeslagen
                </span>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Stat
                  label="Basissaldo dec. 2027"
                  value={euro(result.data.rekka.baselineEnd2027)}
                />
                <Stat
                  label="Scenario saldo dec. 2027"
                  value={euro(result.data.rekka.scenarioEnd2027)}
                />
                <Stat
                  label="Verschil eind 2027"
                  value={euro(balanceDelta2027)}
                  warning={(balanceDelta2027 ?? 0) < 0}
                />
                <Stat
                  label="Laagste saldo t/m prognose"
                  value={euro(result.data.rekka.scenarioLowestBalance)}
                  sub={`${monthName(result.data.rekka.scenarioLowestMonth)} ${result.data.rekka.scenarioLowestYear}`}
                  warning={result.data.rekka.scenarioLowestBalance < 5000}
                />
              </div>
            </section>

            <section className="grid gap-5 lg:grid-cols-2">
              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-bold text-slate-900">
                  Managementfee & btw
                </h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Stat
                    label="Extra fee per maand ex. btw"
                    value={euro(
                      result.data.rules.managementFeeIncreaseExVatMonthly
                    )}
                  />
                  <Stat
                    label="Extra fee per maand incl. btw"
                    value={euro(
                      result.data.rules.managementFeeIncreaseInclVatMonthly
                    )}
                  />
                  <Stat
                    label="Extra fee 2027 incl. btw"
                    value={euro(
                      result.data.totals2027Scenario.extraManagementFeeCashTotal
                    )}
                  />
                  <Stat
                    label="Extra btw 2027"
                    value={euro(result.data.totals2027Scenario.extraVatTotal)}
                  />
                </div>
              </article>

              <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-bold text-slate-900">
                  Loonkasstromen 2027
                </h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <Stat
                    label="Netto loon totaal"
                    value={euro(result.data.totals2027Scenario.totalNetSalary)}
                  />
                  <Stat
                    label="Loonaangifte totaal"
                    value={euro(
                      result.data.totals2027Scenario.totalPayrollReturn
                    )}
                  />
                  <Stat
                    label="Netto per maand"
                    value={euro(result.data.input.netMonthly)}
                  />
                  <Stat
                    label="Loonaangifte per maand"
                    value={euro(result.data.input.payrollReturnMonthly)}
                    sub="één maand later betaald"
                  />
                </div>
              </article>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">
                Doorwerking per maand
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Alleen maanden die door het scenario veranderen worden getoond.
              </p>

              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[760px] text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="pb-2 pr-4">Maand</th>
                      <th className="pb-2 pr-4 text-right">Extra inkomsten</th>
                      <th className="pb-2 pr-4 text-right">Extra uitgaven</th>
                      <th className="pb-2 pr-4 text-right">Eindsaldo</th>
                      <th className="pb-2">Buffer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.affectedMonths.map((row) => (
                      <tr
                        key={`${row.year}-${row.month}`}
                        className="border-b border-slate-100 last:border-0"
                      >
                        <td className="py-3 pr-4 font-semibold text-slate-800">
                          {monthName(row.month)} {row.year}
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums text-emerald-700">
                          {row.incomeDelta ? euro(row.incomeDelta) : "—"}
                        </td>
                        <td className="py-3 pr-4 text-right tabular-nums text-slate-700">
                          {row.expenseDelta ? euro(row.expenseDelta) : "—"}
                        </td>
                        <td
                          className={`py-3 pr-4 text-right font-semibold tabular-nums ${
                            row.belowMinimum ? "text-red-700" : "text-slate-900"
                          }`}
                        >
                          {euro(row.endingBalance)}
                        </td>
                        <td className="py-3">
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                              row.belowMinimum
                                ? "bg-red-100 text-red-800"
                                : "bg-emerald-100 text-emerald-800"
                            }`}
                          >
                            {row.belowMinimum ? "Onder buffer" : "OK"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-slate-700">{label}</span>
        {hint && <span className="text-xs text-slate-400">{hint}</span>}
      </div>
      {children}
    </label>
  );
}

function MoneyInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
        €
      </span>
      <input
        type="number"
        min="0"
        step="0.01"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-slate-300 pl-8 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
      />
    </div>
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
  sub?: string;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        warning
          ? "border-red-200 bg-red-50"
          : "border-slate-200 bg-slate-50"
      }`}
    >
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div
        className={`mt-1 text-lg font-bold tabular-nums ${
          warning ? "text-red-800" : "text-slate-900"
        }`}
      >
        {value}
      </div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  );
}
