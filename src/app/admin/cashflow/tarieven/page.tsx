"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Entity = {
  id: number;
  naam: string;
  type: string;
  actief: boolean;
};

type Stream = {
  id: number;
  naam: string;
  categorie: string;
  van_entiteit_id: number | null;
  van_entiteit: string | null;
  naar_entiteit_id: number | null;
  naar_entiteit: string | null;
  tegenpartij_naam: string | null;
  gedrag: string;
  uitstelbaar: boolean;
  frequentie: string;
  startdatum: string;
  einddatum: string | null;
  actief: boolean;
  berekeningswijze: string | null;
};

type Tariff = {
  id: number;
  stroom_id: number;
  stroom: string;
  geldig_vanaf: string;
  geldig_tot: string | null;
  bedrag: number | string | null;
  percentage_van_bron: number | string | null;
  btw_percentage: number | string | null;
  btw_aftrekbaar_percentage: number | string | null;
  bedrag_is_inclusief_btw: boolean;
};

type CashflowResponse = {
  success: boolean;
  data?: {
    entiteiten: Entity[];
    stromen: Stream[];
    bedragen: Tariff[];
  };
  error?: string;
};

type TariffForm = {
  validFrom: string;
  amount: string;
  vat: string;
  deductible: string;
  inclusive: boolean;
};

function money(value: number | string | null | undefined) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function pct(value: number | string | null | undefined) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return `${new Intl.NumberFormat("nl-NL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n)}%`;
}

function dateOnly(value: string | null | undefined) {
  return value ? String(value).slice(0, 10) : null;
}

function formatDate(value: string | null | undefined) {
  const iso = dateOnly(value);
  if (!iso) return "doorlopend";
  const [year, month, day] = iso.split("-");
  return `${day}-${month}-${year}`;
}

function numberValue(value: string) {
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : NaN;
}

export default function CashflowTarievenPage() {
  const [data, setData] = useState<CashflowResponse["data"] | null>(null);
  const [selectedStreamId, setSelectedStreamId] = useState<number | null>(null);
  const [form, setForm] = useState<TariffForm>({
    validFrom: "",
    amount: "",
    vat: "0",
    deductible: "0",
    inclusive: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function load(preferredStreamId?: number | null) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/cashflow", { cache: "no-store" });
      const json = (await res.json()) as CashflowResponse;

      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || `Tarieven laden mislukt (${res.status})`);
      }

      setData(json.data);

      const fixedStreamIds = new Set(
        json.data.bedragen
          .filter(
            (row) =>
              row.bedrag !== null &&
              row.percentage_van_bron === null
          )
          .map((row) => row.stroom_id)
      );

      const candidates = json.data.stromen.filter(
        (stream) => stream.actief && fixedStreamIds.has(stream.id)
      );

      const nextId =
        preferredStreamId && candidates.some((stream) => stream.id === preferredStreamId)
          ? preferredStreamId
          : selectedStreamId && candidates.some((stream) => stream.id === selectedStreamId)
            ? selectedStreamId
            : candidates[0]?.id ?? null;

      setSelectedStreamId(nextId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tarieven laden mislukt.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const fixedStreams = useMemo(() => {
    if (!data) return [];

    const fixedStreamIds = new Set(
      data.bedragen
        .filter(
          (row) =>
            row.bedrag !== null &&
            row.percentage_van_bron === null
        )
        .map((row) => row.stroom_id)
    );

    return data.stromen
      .filter((stream) => stream.actief && fixedStreamIds.has(stream.id))
      .sort((a, b) => {
        const aEntity = a.van_entiteit || "";
        const bEntity = b.van_entiteit || "";
        return aEntity.localeCompare(bEntity, "nl") || a.naam.localeCompare(b.naam, "nl");
      });
  }, [data]);

  const selectedStream =
    fixedStreams.find((stream) => stream.id === selectedStreamId) ?? null;

  const history = useMemo(() => {
    if (!data || !selectedStreamId) return [];
    return data.bedragen
      .filter(
        (row) =>
          row.stroom_id === selectedStreamId &&
          row.bedrag !== null &&
          row.percentage_van_bron === null
      )
      .sort((a, b) =>
        String(b.geldig_vanaf).localeCompare(String(a.geldig_vanaf))
      );
  }, [data, selectedStreamId]);

  function useTariff(row: Tariff) {
    setForm({
      validFrom: dateOnly(row.geldig_vanaf) || "",
      amount: String(row.bedrag ?? ""),
      vat: String(row.btw_percentage ?? 0),
      deductible: String(row.btw_aftrekbaar_percentage ?? 0),
      inclusive: row.bedrag_is_inclusief_btw !== false,
    });
    setMessage(null);
    setError(null);
  }

  function newTariff() {
    const latest = history[0];
    setForm({
      validFrom: "",
      amount: latest?.bedrag != null ? String(latest.bedrag) : "",
      vat: String(latest?.btw_percentage ?? 0),
      deductible: String(latest?.btw_aftrekbaar_percentage ?? 0),
      inclusive: latest?.bedrag_is_inclusief_btw !== false,
    });
    setMessage(null);
    setError(null);
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!selectedStream) return;

    const amount = numberValue(form.amount);
    const vat = numberValue(form.vat);
    const deductible = numberValue(form.deductible);

    if (!form.validFrom) {
      setError("Ingangsdatum is verplicht.");
      return;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setError("Bedrag moet 0 of hoger zijn.");
      return;
    }
    if (!Number.isFinite(vat) || vat < 0 || vat > 100) {
      setError("BTW-percentage moet tussen 0 en 100 liggen.");
      return;
    }
    if (
      !Number.isFinite(deductible) ||
      deductible < 0 ||
      deductible > 100
    ) {
      setError("BTW-aftrek moet tussen 0 en 100 liggen.");
      return;
    }

    const existingAtDate = history.find(
      (row) => dateOnly(row.geldig_vanaf) === form.validFrom
    );

    const actionText = existingAtDate
      ? `het bestaande tarief van ${selectedStream.naam} per ${formatDate(form.validFrom)} wijzigen naar ${money(amount)}`
      : `een nieuw tarief voor ${selectedStream.naam} vanaf ${formatDate(form.validFrom)} toevoegen van ${money(amount)}`;

    if (
      !window.confirm(
        `Je gaat ${actionText}. Dit wijzigt de echte basisprognose. Doorgaan?`
      )
    ) {
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/cashflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "bedrag",
          stroom_id: selectedStream.id,
          geldig_vanaf: form.validFrom,
          bedrag: amount,
          percentage_van_bron: null,
          btw_percentage: vat,
          btw_aftrekbaar_percentage: deductible,
          bedrag_is_inclusief_btw: form.inclusive,
        }),
      });

      const json = (await res.json()) as CashflowResponse;
      if (!res.ok || !json.success) {
        throw new Error(json.error || `Opslaan mislukt (${res.status})`);
      }

      setMessage(
        `${selectedStream.naam}: tarief vanaf ${formatDate(form.validFrom)} is opgeslagen.`
      );
      await load(selectedStream.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tarief opslaan mislukt.");
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
                Cashflow · fase 4K-B2
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                Vaste tarieven
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Beheer bedragen met een ingangsdatum. Bij een nieuw tarief blijft
                het oude tarief historisch intact en wordt de geldigheidsperiode
                automatisch afgesloten.
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
          Wijzigingen werken direct door in de cashflowprognose. Gebruik
          scenario&apos;s voor tijdelijke aannames.
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
            Tarieven worden geladen…
          </section>
        ) : (
          <section className="grid gap-5 lg:grid-cols-[340px_1fr]">
            <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">
                Vaste geldstromen
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Kies een stroom om de tariefhistorie te bekijken.
              </p>

              <div className="mt-4 max-h-[680px] space-y-2 overflow-y-auto pr-1">
                {fixedStreams.map((stream) => (
                  <button
                    key={stream.id}
                    type="button"
                    onClick={() => {
                      setSelectedStreamId(stream.id);
                      setMessage(null);
                      setError(null);
                      setForm({
                        validFrom: "",
                        amount: "",
                        vat: "0",
                        deductible: "0",
                        inclusive: true,
                      });
                    }}
                    className={`w-full rounded-xl border p-3 text-left ${
                      selectedStreamId === stream.id
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                    }`}
                  >
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {stream.van_entiteit || "Overig"}
                    </div>
                    <div className="mt-1 font-semibold text-slate-900">
                      {stream.naam}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {stream.frequentie} · {stream.categorie}
                    </div>
                  </button>
                ))}
              </div>
            </aside>

            <div className="space-y-5">
              {selectedStream ? (
                <>
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                          {selectedStream.van_entiteit || "Geldstroom"}
                        </div>
                        <h2 className="mt-1 text-2xl font-bold text-slate-900">
                          {selectedStream.naam}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                          {selectedStream.frequentie} · start{" "}
                          {formatDate(selectedStream.startdatum)}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={newTariff}
                        className="h-10 rounded-xl border border-emerald-300 bg-emerald-50 px-4 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
                      >
                        Nieuw tarief vanaf datum
                      </button>
                    </div>

                    <div className="mt-5 overflow-x-auto">
                      <table className="w-full min-w-[720px] text-sm">
                        <thead>
                          <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                            <th className="pb-2 pr-3">Vanaf</th>
                            <th className="pb-2 pr-3">Tot</th>
                            <th className="pb-2 pr-3 text-right">Bedrag</th>
                            <th className="pb-2 pr-3 text-right">BTW</th>
                            <th className="pb-2 pr-3 text-right">Aftrek</th>
                            <th className="pb-2 text-right">Actie</th>
                          </tr>
                        </thead>
                        <tbody>
                          {history.map((row) => (
                            <tr
                              key={row.id}
                              className="border-b border-slate-100 last:border-0"
                            >
                              <td className="py-3 pr-3 font-semibold text-slate-800">
                                {formatDate(row.geldig_vanaf)}
                              </td>
                              <td className="py-3 pr-3 text-slate-600">
                                {formatDate(row.geldig_tot)}
                              </td>
                              <td className="py-3 pr-3 text-right font-semibold tabular-nums text-slate-900">
                                {money(row.bedrag)}
                              </td>
                              <td className="py-3 pr-3 text-right tabular-nums text-slate-700">
                                {pct(row.btw_percentage)}
                              </td>
                              <td className="py-3 pr-3 text-right tabular-nums text-slate-700">
                                {pct(row.btw_aftrekbaar_percentage)}
                              </td>
                              <td className="py-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => useTariff(row)}
                                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                >
                                  Wijzig dit tarief
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>

                  <form
                    onSubmit={save}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <h2 className="text-xl font-bold text-slate-900">
                      Tarief invoeren
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Kies een bestaande ingangsdatum om die tariefregel te
                      wijzigen, of een nieuwe datum om een nieuwe periode te
                      starten.
                    </p>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <Field label="Geldig vanaf *">
                        <input
                          type="date"
                          value={form.validFrom}
                          onChange={(event) =>
                            setForm((prev) => ({
                              ...prev,
                              validFrom: event.target.value,
                            }))
                          }
                          className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                        />
                      </Field>

                      <Field label="Bedrag *">
                        <MoneyInput
                          value={form.amount}
                          onChange={(value) =>
                            setForm((prev) => ({ ...prev, amount: value }))
                          }
                        />
                      </Field>

                      <Field label="BTW">
                        <PercentInput
                          value={form.vat}
                          onChange={(value) =>
                            setForm((prev) => ({ ...prev, vat: value }))
                          }
                        />
                      </Field>

                      <Field label="BTW aftrekbaar">
                        <PercentInput
                          value={form.deductible}
                          onChange={(value) =>
                            setForm((prev) => ({
                              ...prev,
                              deductible: value,
                            }))
                          }
                        />
                      </Field>
                    </div>

                    <label className="mt-4 flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={form.inclusive}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            inclusive: event.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      Bedrag is inclusief BTW
                    </label>

                    <button
                      type="submit"
                      disabled={saving}
                      className="mt-5 h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? "Opslaan…" : "Tarief opslaan"}
                    </button>
                  </form>
                </>
              ) : (
                <section className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
                  Geen vaste geldstroom gevonden.
                </section>
              )}
            </div>
          </section>
        )}
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
        min="0"
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
