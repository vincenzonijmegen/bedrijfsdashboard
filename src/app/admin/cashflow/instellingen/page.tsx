"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Entity = {
  id: number;
  naam: string;
  type: string;
  actief: boolean;
  minimum_kasbuffer: number | string | null;
  prognosegroei_pct: number | string | null;
  loonkosten_groei_pct: number | string | null;
};

type CashflowAdminResponse = {
  success: boolean;
  data?: {
    entiteiten: Entity[];
  };
  error?: string;
};

type EntityForm = {
  minimum: string;
  growth: string;
  wageGrowth: string;
};

function numberString(value: number | string | null | undefined) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function parseOptionalNumber(value: string) {
  if (value.trim() === "") return null;
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : NaN;
}

function euro(value: string) {
  const n = Number(value.replace(",", "."));
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

export default function CashflowInstellingenPage() {
  const [entities, setEntities] = useState<Entity[]>([]);
  const [forms, setForms] = useState<Record<number, EntityForm>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/cashflow", { cache: "no-store" });
      const json = (await res.json()) as CashflowAdminResponse;

      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || `Instellingen laden mislukt (${res.status})`);
      }

      const nextForms: Record<number, EntityForm> = {};
      for (const entity of json.data.entiteiten) {
        nextForms[entity.id] = {
          minimum: numberString(entity.minimum_kasbuffer),
          growth: numberString(entity.prognosegroei_pct),
          wageGrowth: numberString(entity.loonkosten_groei_pct),
        };
      }

      setEntities(json.data.entiteiten);
      setForms(nextForms);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Cashflowinstellingen laden mislukt."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const activeEntities = useMemo(
    () => entities.filter((entity) => entity.actief !== false),
    [entities]
  );

  function updateForm(
    id: number,
    field: keyof EntityForm,
    value: string
  ) {
    setForms((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value,
      },
    }));
  }

  function validate(entity: Entity, form: EntityForm) {
    const minimum = parseOptionalNumber(form.minimum);
    const growth = parseOptionalNumber(form.growth);
    const wageGrowth = parseOptionalNumber(form.wageGrowth);

    if (minimum === null || Number.isNaN(minimum) || minimum < 0) {
      return "Minimum buffer moet een bedrag van 0 of hoger zijn.";
    }

    if (
      growth !== null &&
      (Number.isNaN(growth) || growth < -50 || growth > 100)
    ) {
      return "Prognosegroei moet tussen -50% en 100% liggen.";
    }

    if (
      entity.type === "werkmaatschappij" &&
      wageGrowth !== null &&
      (Number.isNaN(wageGrowth) || wageGrowth < -50 || wageGrowth > 100)
    ) {
      return "Loonkostengroei moet tussen -50% en 100% liggen.";
    }

    return null;
  }

  async function save(entity: Entity, event?: FormEvent) {
    event?.preventDefault();

    const form = forms[entity.id];
    if (!form) return;

    const validationError = validate(entity, form);
    if (validationError) {
      setError(validationError);
      setMessage(null);
      return;
    }

    setBusyId(entity.id);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/cashflow", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "instelling",
          entiteit_id: entity.id,
          minimum_kasbuffer: parseOptionalNumber(form.minimum),
          prognosegroei_pct: parseOptionalNumber(form.growth),
          loonkosten_groei_pct:
            entity.type === "werkmaatschappij"
              ? parseOptionalNumber(form.wageGrowth)
              : parseOptionalNumber(form.wageGrowth),
        }),
      });

      const json = (await res.json()) as CashflowAdminResponse;
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Opslaan mislukt (${res.status})`);
      }

      setMessage(`${entity.naam} is opgeslagen.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opslaan mislukt.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                Cashflow · fase 4K-B1
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                Basisinstellingen
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Beheer de minimum kasbuffers en groeipercentages die de
                basisprognose gebruikt. Scenario&apos;s blijven hier volledig
                buiten.
              </p>
            </div>

            <a
              href="/admin/cashflow/dashboard"
              className="inline-flex h-10 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Terug naar dashboard
            </a>
          </div>
        </section>

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 shadow-sm">
          <span className="font-semibold">Dit zijn echte basisgegevens.</span>{" "}
          Na opslaan gebruikt de cashflowprognose de nieuwe waarde direct. Een
          scenario wijzigt deze instellingen niet.
        </section>

        {message && (
          <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-800 shadow-sm">
            {message}
          </section>
        )}

        {error && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 shadow-sm">
            {error}
          </section>
        )}

        {loading ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            Basisinstellingen worden geladen…
          </section>
        ) : (
          <section className="grid gap-5 lg:grid-cols-3">
            {activeEntities.map((entity) => {
              const form = forms[entity.id];
              if (!form) return null;

              const isWorkCompany = entity.type === "werkmaatschappij";
              const currentMinimum = euro(form.minimum);

              return (
                <form
                  key={entity.id}
                  onSubmit={(event) => save(entity, event)}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {isWorkCompany ? "Werkmaatschappij" : "Holding"}
                    </div>
                    <h2 className="mt-1 text-xl font-bold text-slate-900">
                      {entity.naam}
                    </h2>
                    <div className="mt-1 text-sm text-slate-500">
                      Huidige buffer {currentMinimum}
                    </div>
                  </div>

                  <div className="mt-5 space-y-4">
                    <Field
                      label="Minimum kasbuffer"
                      hint="waarschuwingsgrens"
                    >
                      <MoneyInput
                        value={form.minimum}
                        onChange={(value) =>
                          updateForm(entity.id, "minimum", value)
                        }
                      />
                    </Field>

                    <Field
                      label={
                        isWorkCompany
                          ? "Omzetgroei per jaar"
                          : "Prognosegroei per jaar"
                      }
                      hint="%"
                    >
                      <PercentInput
                        value={form.growth}
                        onChange={(value) =>
                          updateForm(entity.id, "growth", value)
                        }
                      />
                    </Field>

                    {isWorkCompany && (
                      <Field
                        label="Loonkostengroei per jaar"
                        hint="%"
                      >
                        <PercentInput
                          value={form.wageGrowth}
                          onChange={(value) =>
                            updateForm(entity.id, "wageGrowth", value)
                          }
                        />
                      </Field>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={busyId !== null}
                    className="mt-5 h-11 w-full rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busyId === entity.id ? "Opslaan…" : "Opslaan"}
                  </button>
                </form>
              );
            })}
          </section>
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
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-slate-300 pl-8 pr-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
      />
    </div>
  );
}

function PercentInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        min="-50"
        max="100"
        step="0.1"
        inputMode="decimal"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-xl border border-slate-300 px-3 pr-9 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
        %
      </span>
    </div>
  );
}
