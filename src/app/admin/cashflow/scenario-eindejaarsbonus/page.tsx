"use client";

import { FormEvent, useState } from "react";

type ScenarioLine = {
  streamId: number;
  name: string;
  category: string;
  direction: "in" | "uit";
  amount: number;
  vatPart: number;
  source: string;
};

type PersonScenario = {
  person: "Robert" | "Emo";
  entity: string;
  input: {
    year: number;
    grossBonus: number;
    netBonus: number;
    payrollReturn: number;
  };
  managementFee: {
    extraExVat: number;
    vat: number;
    extraInclVat: number;
  };
  december: {
    key: string;
    baselineEndingBalance: number;
    scenarioEndingBalance: number;
    balanceDelta: number;
    scenarioLines: ScenarioLine[];
  };
  january: {
    key: string;
    baselineEndingBalance: number;
    scenarioEndingBalance: number;
    balanceDelta: number;
    scenarioLines: ScenarioLine[];
  };
  validation: {
    expectedDecemberDelta: number;
    expectedLongRunDelta: number;
    actualLongRunDelta: number;
    matchesExpectedLongRunDelta: boolean;
  };
  forecast: {
    lowestBalance: number;
    lowestYear: number;
    lowestMonth: number;
    endingBalance: number;
  };
};

type BonusResponse = {
  success: boolean;
  fase: string;
  data?: {
    available: boolean;
    scenario: string;
    rules: {
      month: number;
      maxGrossPerPerson: number;
      managementFeeIncreaseEqualsGrossExVat: boolean;
      vatPercentage: number;
      payrollReturnPaidInFollowingJanuary: boolean;
      bonusStoredInBaseForecast: boolean;
    };
    scenarios: PersonScenario[];
    summary: {
      year: number;
      persons: string[];
      totalGrossBonus: number;
      allValidationsClean: boolean;
    };
  };
  error?: string;
};

type PersonForm = {
  gross: string;
  net: string;
  payroll: string;
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

function parseNumber(value: string) {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function formIsEmpty(form: PersonForm) {
  return !form.gross.trim() && !form.net.trim() && !form.payroll.trim();
}

function formIsValid(form: PersonForm) {
  if (formIsEmpty(form)) return true;

  const gross = parseNumber(form.gross);
  const net = parseNumber(form.net);
  const payroll = parseNumber(form.payroll);

  return (
    Number.isFinite(gross) &&
    gross > 0 &&
    gross <= 20000 &&
    Number.isFinite(net) &&
    net > 0 &&
    net <= gross &&
    Number.isFinite(payroll) &&
    payroll > 0
  );
}

export default function EindejaarsbonusScenarioPage() {
  const [year, setYear] = useState(2028);
  const [toYear, setToYear] = useState(2029);
  const [robert, setRobert] = useState<PersonForm>({
    gross: "",
    net: "",
    payroll: "",
  });
  const [emo, setEmo] = useState<PersonForm>({
    gross: "",
    net: "",
    payroll: "",
  });

  const [result, setResult] = useState<BonusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const anyPerson = !formIsEmpty(robert) || !formIsEmpty(emo);
  const valid =
    anyPerson &&
    formIsValid(robert) &&
    formIsValid(emo) &&
    toYear >= year + 1;

  function updatePerson(
    setter: React.Dispatch<React.SetStateAction<PersonForm>>,
    field: keyof PersonForm,
    value: string
  ) {
    setter((prev) => ({ ...prev, [field]: value }));
  }

  async function runScenario(event: FormEvent) {
    event.preventDefault();
    if (!valid) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const params = new URLSearchParams({
        jaar: String(year),
        tot: String(toYear),
      });

      if (!formIsEmpty(robert)) {
        params.set("robert_bruto", String(parseNumber(robert.gross)));
        params.set("robert_netto", String(parseNumber(robert.net)));
        params.set(
          "robert_loonaangifte",
          String(parseNumber(robert.payroll))
        );
      }

      if (!formIsEmpty(emo)) {
        params.set("emo_bruto", String(parseNumber(emo.gross)));
        params.set("emo_netto", String(parseNumber(emo.net)));
        params.set("emo_loonaangifte", String(parseNumber(emo.payroll)));
      }

      const res = await fetch(
        `/api/admin/cashflow/scenario-eindejaarsbonus?${params.toString()}`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as BonusResponse;

      if (!res.ok || !json.success) {
        throw new Error(json.error || `Scenario laden mislukt (${res.status})`);
      }

      if (!json.data?.available) {
        throw new Error(
          "De basisberekening van de holdings is niet volledig beschikbaar."
        );
      }

      setResult(json);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Scenario berekenen mislukt."
      );
    } finally {
      setLoading(false);
    }
  }

  function clearAll() {
    setRobert({ gross: "", net: "", payroll: "" });
    setEmo({ gross: "", net: "", payroll: "" });
    setResult(null);
    setError(null);
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-600">
                Cashflow · fase 4J-B2
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                Scenario eindejaarsbonus
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Reken optionele bruto eindejaarsbonussen voor Robert en/of Emo
                door. De bonus loopt via de loonadministratie en Vincenzo
                verhoogt de managementfee met hetzelfde brutobedrag exclusief
                btw.
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

        <section className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900 shadow-sm">
          <span className="font-semibold">Alleen scenario.</span>{" "}
          De bonus wordt niet in de basisprognose opgeslagen. Netto bonus en
          loonaangifte moeten uit een loonberekening of pro-forma komen.
        </section>

        <form
          onSubmit={runScenario}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-end gap-4">
            <Field label="Bonusjaar">
              <select
                value={year}
                onChange={(e) => {
                  const nextYear = Number(e.target.value);
                  setYear(nextYear);
                  if (toYear < nextYear + 1) setToYear(nextYear + 1);
                }}
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm"
              >
                {[2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035].map(
                  (value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  )
                )}
              </select>
            </Field>

            <Field label="Prognose t/m">
              <select
                value={toYear}
                onChange={(e) => setToYear(Number(e.target.value))}
                className="h-11 rounded-xl border border-slate-300 bg-white px-3 text-sm"
              >
                {Array.from({ length: Math.max(0, 2036 - year) }, (_, i) => year + 1 + i).map(
                  (value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  )
                )}
              </select>
            </Field>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <PersonCard
              title="Robert · Eetje Pans Holding B.V."
              form={robert}
              onChange={(field, value) =>
                updatePerson(setRobert, field, value)
              }
            />
            <PersonCard
              title="Emo · Rekka Holding B.V."
              form={emo}
              onChange={(field, value) => updatePerson(setEmo, field, value)}
            />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={!valid || loading}
              className="h-11 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {loading ? "Berekenen…" : "Bereken bonusscenario"}
            </button>

            <button
              type="button"
              onClick={clearAll}
              className="h-11 rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Wis invoer
            </button>

            <span className="text-xs text-slate-500">
              Maximaal € 20.000 bruto per persoon.
            </span>
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
                    Uitkomst bonusjaar {result.data.summary.year}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {result.data.summary.persons.join(" & ")} · totaal bruto{" "}
                    {euro(result.data.summary.totalGrossBonus)}
                  </p>
                </div>

                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    result.data.summary.allValidationsClean
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {result.data.summary.allValidationsClean
                    ? "Controle schoon"
                    : "Controle wijkt af"}
                </span>
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-2">
              {result.data.scenarios.map((scenario) => (
                <article
                  key={scenario.person}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="border-b border-slate-200 p-5">
                    <h2 className="text-xl font-bold text-slate-900">
                      {scenario.person}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {scenario.entity}
                    </p>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <Stat
                        label="Bruto bonus"
                        value={euro(scenario.input.grossBonus)}
                      />
                      <Stat
                        label="Netto bonus"
                        value={euro(scenario.input.netBonus)}
                      />
                      <Stat
                        label="Loonaangifte"
                        value={euro(scenario.input.payrollReturn)}
                      />
                    </div>
                  </div>

                  <div className="p-5">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
                      Extra managementfee
                    </h3>

                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                      <Stat
                        label="Excl. btw"
                        value={euro(scenario.managementFee.extraExVat)}
                      />
                      <Stat
                        label="Btw"
                        value={euro(scenario.managementFee.vat)}
                      />
                      <Stat
                        label="Incl. btw"
                        value={euro(scenario.managementFee.extraInclVat)}
                      />
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <PeriodCard
                        title={`December ${scenario.input.year}`}
                        base={scenario.december.baselineEndingBalance}
                        scenario={scenario.december.scenarioEndingBalance}
                        delta={scenario.december.balanceDelta}
                      />
                      <PeriodCard
                        title={`Januari ${scenario.input.year + 1}`}
                        base={scenario.january.baselineEndingBalance}
                        scenario={scenario.january.scenarioEndingBalance}
                        delta={scenario.january.balanceDelta}
                      />
                    </div>

                    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Blijvend effect na btw & loonaangifte
                      </div>
                      <div
                        className={`mt-1 text-xl font-bold tabular-nums ${
                          scenario.validation.actualLongRunDelta < 0
                            ? "text-red-700"
                            : "text-emerald-700"
                        }`}
                      >
                        {euro(scenario.validation.actualLongRunDelta)}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Verwacht {euro(scenario.validation.expectedLongRunDelta)}
                        {" · "}
                        {scenario.validation.matchesExpectedLongRunDelta
                          ? "controle klopt"
                          : "controle wijkt af"}
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">
                      <Stat
                        label="Laagste saldo prognose"
                        value={euro(scenario.forecast.lowestBalance)}
                        sub={`${monthName(scenario.forecast.lowestMonth)} ${scenario.forecast.lowestYear}`}
                        warning={scenario.forecast.lowestBalance < 5000}
                      />
                      <Stat
                        label="Eindsaldo prognose"
                        value={euro(scenario.forecast.endingBalance)}
                        warning={scenario.forecast.endingBalance < 5000}
                      />
                      <Stat
                        label="Validatie"
                        value={
                          scenario.validation.matchesExpectedLongRunDelta
                            ? "Schoon"
                            : "Afwijking"
                        }
                        warning={!scenario.validation.matchesExpectedLongRunDelta}
                      />
                    </div>
                  </div>
                </article>
              ))}
            </section>
          </>
        )}
      </div>
    </main>
  );
}

function PersonCard({
  title,
  form,
  onChange,
}: {
  title: string;
  form: PersonForm;
  onChange: (field: keyof PersonForm, value: string) => void;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <h2 className="font-bold text-slate-900">{title}</h2>
      <p className="mt-1 text-xs text-slate-500">
        Laat alle velden leeg om deze persoon niet mee te nemen.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
        <Field label="Bruto bonus">
          <MoneyInput
            value={form.gross}
            onChange={(value) => onChange("gross", value)}
          />
        </Field>
        <Field label="Netto bonus">
          <MoneyInput
            value={form.net}
            onChange={(value) => onChange("net", value)}
          />
        </Field>
        <Field label="Loonaangifte">
          <MoneyInput
            value={form.payroll}
            onChange={(value) => onChange("payroll", value)}
          />
        </Field>
      </div>
    </article>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="mb-1.5 text-sm font-semibold text-slate-700">{label}</div>
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
        max="20000"
        step="0.01"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-slate-300 bg-white pl-8 pr-3 text-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100"
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
      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
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

function PeriodCard({
  title,
  base,
  scenario,
  delta,
}: {
  title: string;
  base: number;
  scenario: number;
  delta: number;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="font-semibold text-slate-900">{title}</div>

      <div className="mt-3 space-y-2 text-sm">
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-500">Basis</span>
          <span className="font-semibold tabular-nums text-slate-800">
            {euro(base)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-slate-500">Scenario</span>
          <span className="font-semibold tabular-nums text-slate-900">
            {euro(scenario)}
          </span>
        </div>
        <div className="border-t border-slate-100 pt-2">
          <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">Verschil</span>
            <span
              className={`font-bold tabular-nums ${
                delta < 0 ? "text-red-700" : "text-emerald-700"
              }`}
            >
              {euro(delta)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
