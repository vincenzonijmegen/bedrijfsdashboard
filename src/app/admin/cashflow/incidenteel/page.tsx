"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Entity = {
  id: number;
  name: string;
  type: string;
};

type Item = {
  id: number;
  entityId: number;
  entity: string;
  entityType: string;
  date: string;
  description: string;
  amount: number;
  direction: "in" | "uit";
  category: string;
  counterparty: string | null;
  vatPct: number;
  deductiblePct: number;
  amountIncludesVat: boolean;
  postponable: boolean;
  status: string;
  reason: string | null;
  paidOn: string | null;
  editable: boolean;
};

type ApiResponse = {
  success: boolean;
  fase: string;
  data?: {
    entities: Entity[];
    items: Item[];
  };
  saved?: { id: number };
  deleted?: { id: number };
  error?: string;
};

type FormState = {
  id: number | null;
  entityId: string;
  date: string;
  direction: "uit" | "in";
  amount: string;
  description: string;
  category: string;
  counterparty: string;
  vatPct: string;
  deductiblePct: string;
  postponable: boolean;
  reason: string;
};

const EMPTY_FORM: FormState = {
  id: null,
  entityId: "",
  date: "",
  direction: "uit",
  amount: "",
  description: "",
  category: "overig_incidenteel",
  counterparty: "",
  vatPct: "0",
  deductiblePct: "0",
  postponable: false,
  reason: "",
};

const CATEGORIES = [
  ["investering", "Investering"],
  ["incidentele_reparatie", "Reparatie / onderhoud"],
  ["eenmalige_kosten", "Eenmalige kosten"],
  ["naheffing", "Naheffing / belasting"],
  ["teruggaaf", "Teruggaaf / bijzondere ontvangst"],
  ["overig_incidenteel", "Overig incidenteel"],
];

function euro(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function dateNl(value: string) {
  const [year, month, day] = value.split("-");
  return `${day}-${month}-${year}`;
}

function numberValue(value: string) {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

export default function IncidenteleKasstromenPage() {
  const currentYear = new Date().getFullYear();
  const [fromYear, setFromYear] = useState(currentYear);
  const [toYear, setToYear] = useState(currentYear + 3);
  const [data, setData] = useState<ApiResponse["data"] | null>(null);
  const [filterEntity, setFilterEntity] = useState("all");
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `/api/admin/cashflow/incidenteel?van=${fromYear}&tot=${toYear}`,
        { cache: "no-store" }
      );
      const json = (await res.json()) as ApiResponse;

      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || `Laden mislukt (${res.status})`);
      }

      setData(json.data);

      if (!form.entityId && json.data.entities.length) {
        setForm((prev) => ({
          ...prev,
          entityId: String(json.data!.entities[0].id),
        }));
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Incidentele kasstromen laden mislukt."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [fromYear, toYear]);

  const visibleItems = useMemo(() => {
    const items = data?.items ?? [];
    if (filterEntity === "all") return items;
    return items.filter((item) => String(item.entityId) === filterEntity);
  }, [data, filterEntity]);

  function resetForm() {
    setForm((prev) => ({
      ...EMPTY_FORM,
      entityId:
        prev.entityId ||
        (data?.entities?.[0] ? String(data.entities[0].id) : ""),
    }));
    setError(null);
  }

  function edit(item: Item) {
    setForm({
      id: item.id,
      entityId: String(item.entityId),
      date: item.date,
      direction: item.direction,
      amount: String(item.amount),
      description: item.description,
      category: item.category,
      counterparty: item.counterparty ?? "",
      vatPct: String(item.vatPct),
      deductiblePct: String(item.deductiblePct),
      postponable: item.postponable,
      reason: item.reason ?? "",
    });
    setMessage(null);
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(event: FormEvent) {
    event.preventDefault();

    const amount = numberValue(form.amount);
    const vatPct = numberValue(form.vatPct);
    const deductiblePct = numberValue(form.deductiblePct);

    if (!form.entityId) {
      setError("Kies een entiteit.");
      return;
    }
    if (!form.date) {
      setError("Datum is verplicht.");
      return;
    }
    if (!form.description.trim()) {
      setError("Omschrijving is verplicht.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Bedrag moet groter dan 0 zijn.");
      return;
    }
    if (!Number.isFinite(vatPct) || vatPct < 0 || vatPct > 100) {
      setError("BTW-percentage is ongeldig.");
      return;
    }
    if (
      form.direction === "uit" &&
      (!Number.isFinite(deductiblePct) ||
        deductiblePct < 0 ||
        deductiblePct > 100)
    ) {
      setError("BTW-aftrekbaar percentage is ongeldig.");
      return;
    }

    const entity = data?.entities.find(
      (row) => String(row.id) === form.entityId
    );

    const action = form.id ? "wijzigen" : "toevoegen";
    if (
      !window.confirm(
        `${action === "toevoegen" ? "Toevoegen" : "Wijzigen"}: ${
          form.description
        } · ${euro(amount)} · ${entity?.name ?? "entiteit"} · ${
          dateNl(form.date)
        }. Dit wijzigt de echte basisprognose. Doorgaan?`
      )
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/cashflow/incidenteel", {
        method: form.id ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: form.id,
          entiteit_id: Number(form.entityId),
          datum: form.date,
          omschrijving: form.description.trim(),
          bedrag: amount,
          richting: form.direction,
          categorie: form.category,
          tegenpartij_naam: form.counterparty.trim() || null,
          btw_percentage: vatPct,
          btw_aftrekbaar_percentage:
            form.direction === "uit" ? deductiblePct : 0,
          uitstelbaar: form.postponable,
          reden: form.reason.trim() || null,
        }),
      });

      const json = (await res.json()) as ApiResponse;
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Opslaan mislukt (${res.status})`);
      }

      setMessage(
        `${form.description.trim()} is ${
          form.id ? "gewijzigd" : "toegevoegd"
        }.`
      );
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Opslaan mislukt.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(item: Item) {
    if (!item.editable) return;

    if (
      !window.confirm(
        `Verwijder ${item.description} (${euro(item.amount)}) uit de cashflowprognose?`
      )
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/cashflow/incidenteel", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      const json = (await res.json()) as ApiResponse;
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Verwijderen mislukt (${res.status})`);
      }

      setMessage(`${item.description} is verwijderd.`);
      if (form.id === item.id) resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verwijderen mislukt.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                Cashflow · fase 4K-B3
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                Incidentele kasstromen
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Voor bijzondere of materiële eenmalige posten die niet al in de
                normale maandprofielen zitten.
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

        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 shadow-sm">
          <span className="font-semibold">Geen bonnetjesadministratie.</span>{" "}
          Een gewoon AH-bezoek, kleine losse inkoop of normale dagelijkse
          uitgave hoef je hier niet in te voeren. Die zitten al in het
          reguliere maandprofiel. Gebruik dit scherm alleen voor posten die de
          prognose merkbaar veranderen.
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

        <form
          onSubmit={save}
          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                {form.id ? "Post wijzigen" : "Nieuwe incidentele post"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Bedrag is altijd het kasbedrag inclusief eventuele BTW.
              </p>
            </div>

            {form.id && (
              <button
                type="button"
                onClick={resetForm}
                className="h-10 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700"
              >
                Nieuwe post
              </button>
            )}
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Field label="Entiteit *">
              <select
                value={form.entityId}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, entityId: e.target.value }))
                }
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
              >
                {(data?.entities ?? []).map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Datum *">
              <input
                type="date"
                value={form.date}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, date: e.target.value }))
                }
                className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
              />
            </Field>

            <Field label="Richting *">
              <select
                value={form.direction}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    direction: e.target.value === "in" ? "in" : "uit",
                    deductiblePct:
                      e.target.value === "in" ? "0" : prev.deductiblePct,
                  }))
                }
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="uit">Uitgave</option>
                <option value="in">Ontvangst</option>
              </select>
            </Field>

            <Field label="Bedrag incl. BTW *">
              <MoneyInput
                value={form.amount}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, amount: value }))
                }
              />
            </Field>

            <Field label="Omschrijving *">
              <input
                type="text"
                maxLength={300}
                value={form.description}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                placeholder="Bijv. reparatie ijsmachine"
              />
            </Field>

            <Field label="Categorie">
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, category: e.target.value }))
                }
                className="h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm"
              >
                {CATEGORIES.map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Tegenpartij">
              <input
                type="text"
                value={form.counterparty}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    counterparty: e.target.value,
                  }))
                }
                className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                placeholder="optioneel"
              />
            </Field>

            <Field label="BTW %">
              <PercentInput
                value={form.vatPct}
                onChange={(value) =>
                  setForm((prev) => ({ ...prev, vatPct: value }))
                }
              />
            </Field>

            {form.direction === "uit" && (
              <Field label="BTW aftrekbaar %">
                <PercentInput
                  value={form.deductiblePct}
                  onChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      deductiblePct: value,
                    }))
                  }
                />
              </Field>
            )}

            <Field label="Toelichting">
              <input
                type="text"
                value={form.reason}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, reason: e.target.value }))
                }
                className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                placeholder="waarom incidenteel?"
              />
            </Field>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.postponable}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  postponable: e.target.checked,
                }))
              }
            />
            Deze post kan eventueel worden uitgesteld
          </label>

          <button
            type="submit"
            disabled={saving || loading}
            className="mt-5 h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving
              ? "Opslaan…"
              : form.id
                ? "Wijziging opslaan"
                : "Post toevoegen"}
          </button>
        </form>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Bestaande incidentele posten
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Betaalde historische posten zijn vergrendeld; geplande posten
                kun je wijzigen of verwijderen.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <label className="text-sm text-slate-700">
                Van
                <select
                  value={fromYear}
                  onChange={(e) => setFromYear(Number(e.target.value))}
                  className="ml-2 h-10 rounded-xl border border-slate-300 bg-white px-3"
                >
                  {Array.from({ length: 8 }, (_, i) => currentYear - 1 + i).map(
                    (year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label className="text-sm text-slate-700">
                T/m
                <select
                  value={toYear}
                  onChange={(e) => setToYear(Number(e.target.value))}
                  className="ml-2 h-10 rounded-xl border border-slate-300 bg-white px-3"
                >
                  {Array.from({ length: 10 }, (_, i) => currentYear + i).map(
                    (year) => (
                      <option key={year} value={year}>
                        {year}
                      </option>
                    )
                  )}
                </select>
              </label>

              <select
                value={filterEntity}
                onChange={(e) => setFilterEntity(e.target.value)}
                className="h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="all">Alle entiteiten</option>
                {(data?.entities ?? []).map((entity) => (
                  <option key={entity.id} value={entity.id}>
                    {entity.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="mt-5 text-sm text-slate-500">Laden…</div>
          ) : (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[1000px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="pb-2 pr-3">Datum</th>
                    <th className="pb-2 pr-3">Entiteit</th>
                    <th className="pb-2 pr-3">Omschrijving</th>
                    <th className="pb-2 pr-3">Richting</th>
                    <th className="pb-2 pr-3 text-right">Bedrag</th>
                    <th className="pb-2 pr-3 text-right">BTW</th>
                    <th className="pb-2 pr-3">Status</th>
                    <th className="pb-2 text-right">Acties</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleItems.map((item) => (
                    <tr
                      key={item.id}
                      className="border-b border-slate-100 last:border-0"
                    >
                      <td className="py-3 pr-3">{dateNl(item.date)}</td>
                      <td className="py-3 pr-3 font-medium">{item.entity}</td>
                      <td className="py-3 pr-3">
                        <div className="font-semibold text-slate-900">
                          {item.description}
                        </div>
                        {(item.counterparty || item.reason) && (
                          <div className="mt-0.5 text-xs text-slate-500">
                            {[item.counterparty, item.reason]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        )}
                      </td>
                      <td
                        className={`py-3 pr-3 font-semibold ${
                          item.direction === "in"
                            ? "text-emerald-700"
                            : "text-slate-800"
                        }`}
                      >
                        {item.direction === "in" ? "Ontvangst" : "Uitgave"}
                      </td>
                      <td className="py-3 pr-3 text-right font-semibold tabular-nums">
                        {euro(item.amount)}
                      </td>
                      <td className="py-3 pr-3 text-right tabular-nums">
                        {item.vatPct}%
                      </td>
                      <td className="py-3 pr-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                            item.status === "betaald"
                              ? "bg-slate-100 text-slate-700"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {item.editable ? (
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => edit(item)}
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold"
                            >
                              Wijzig
                            </button>
                            <button
                              type="button"
                              onClick={() => remove(item)}
                              className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700"
                            >
                              Verwijder
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">
                            historisch
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}

                  {visibleItems.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="py-8 text-center text-sm text-slate-500"
                      >
                        Geen incidentele posten in deze selectie.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
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
        step="0.01"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-slate-300 pl-8 pr-3 text-sm"
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
        min="0"
        max="100"
        step="0.1"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-slate-300 px-3 pr-9 text-sm"
      />
      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">
        %
      </span>
    </div>
  );
}
