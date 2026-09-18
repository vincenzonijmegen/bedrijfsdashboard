"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Account = {
  id: number;
  name: string;
  type: string;
  balance: number | null;
  balanceDate: string | null;
};

type FreeRoom = {
  originalCrediting: number;
  alreadyWithdrawn: number;
  remaining: number;
  balanceDate: string;
};

type Entity = {
  id: number;
  name: string;
  type: string;
  currentDate: string | null;
  currentTotal: number | null;
  accounts: Account[];
  freeRoom: FreeRoom | null;
};

type History = {
  id: number;
  entityId: number;
  entity: string;
  date: string;
  total: number;
  freeRoomRemaining: number | null;
  source: string;
  note: string | null;
  createdAt: string;
  accounts: Array<{
    accountId: number;
    accountName: string;
    accountType: string;
    balance: number;
  }>;
};

type ApiResponse = {
  success: boolean;
  fase: string;
  data?: {
    entities: Entity[];
    history: History[];
  };
  dryRun?: boolean;
  checked?: {
    entityId: number;
    entity: string;
    previousDate: string;
    newDate: string;
    total: number;
    freeRoomRemaining: number | null;
    accountCount: number;
  };
  saved?: {
    snapshotId: number;
    entityId: number;
    entity: string;
    previousDate: string;
    newDate: string;
    total: number;
    freeRoomRemaining: number | null;
    accountCount: number;
  };
  checkedRestore?: {
    snapshotId: number;
    entityId: number;
    entity: string;
    currentDate: string;
    restoredDate: string;
    total: number;
    freeRoomRemaining: number | null;
    accountCount: number;
  };
  restored?: {
    snapshotId: number;
    entityId: number;
    entity: string;
    previousDate: string;
    restoredDate: string;
    total: number;
    freeRoomRemaining: number | null;
    accountCount: number;
  };
  error?: string;
};

type FormState = {
  date: string;
  balances: Record<number, string>;
  freeRoomRemaining: string;
  note: string;
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

function dateNl(value: string | null | undefined) {
  if (!value) return "—";
  const [year, month, day] = value.split("-");
  return `${day}-${month}-${year}`;
}

function parseNumber(value: string) {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
}

function lastDayOfMonth(year: number, month: number) {
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function nextMonthEnd(afterDate: string | null) {
  if (!afterDate) return "";
  const [year, month] = afterDate.split("-").map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return lastDayOfMonth(nextYear, nextMonth);
}

function todayIso() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function ActueleSaldiPage() {
  const [data, setData] = useState<ApiResponse["data"] | null>(null);
  const [entityId, setEntityId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>({
    date: "",
    balances: {},
    freeRoomRemaining: "",
    note: "",
  });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"check" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [lastCheck, setLastCheck] = useState<ApiResponse["checked"] | null>(
    null
  );
  const [restoreBusyId, setRestoreBusyId] = useState<number | null>(null);
  const [restoreCheckId, setRestoreCheckId] = useState<number | null>(null);

  async function load(preferredEntityId?: number | null) {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/cashflow/saldi", {
        cache: "no-store",
      });
      const json = (await res.json()) as ApiResponse;

      if (!res.ok || !json.success || !json.data) {
        throw new Error(json.error || `Saldi laden mislukt (${res.status})`);
      }

      setData(json.data);

      const nextEntityId =
        preferredEntityId &&
        json.data.entities.some((entity) => entity.id === preferredEntityId)
          ? preferredEntityId
          : entityId &&
              json.data.entities.some((entity) => entity.id === entityId)
            ? entityId
            : json.data.entities[0]?.id ?? null;

      setEntityId(nextEntityId);

      const entity = json.data.entities.find(
        (row) => row.id === nextEntityId
      );
      if (entity) fillFromEntity(entity);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Actuele saldi laden mislukt."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const entity =
    data?.entities.find((row) => row.id === entityId) ?? null;

  const history = useMemo(
    () =>
      (data?.history ?? []).filter(
        (row) => entityId != null && row.entityId === entityId
      ),
    [data, entityId]
  );

  const enteredTotal = useMemo(() => {
    if (!entity) return null;
    let total = 0;

    for (const account of entity.accounts) {
      const value = parseNumber(form.balances[account.id] ?? "");
      if (!Number.isFinite(value)) return null;
      total += value;
    }

    return Math.round(total * 100) / 100;
  }, [entity, form.balances]);

  const nextAllowedDate = entity ? nextMonthEnd(entity.currentDate) : "";
  const today = todayIso();
  const canActivate =
    Boolean(form.date) &&
    Boolean(nextAllowedDate) &&
    form.date >= nextAllowedDate &&
    form.date <= today;

  function fillFromEntity(selected: Entity) {
    setForm({
      date: nextMonthEnd(selected.currentDate),
      balances: Object.fromEntries(
        selected.accounts.map((account) => [
          account.id,
          account.balance == null ? "" : String(account.balance),
        ])
      ),
      freeRoomRemaining:
        selected.freeRoom == null ? "" : String(selected.freeRoom.remaining),
      note: "",
    });
    setLastCheck(null);
    setMessage(null);
  }

  function chooseEntity(id: number) {
    setEntityId(id);
    const selected = data?.entities.find((row) => row.id === id);
    if (selected) fillFromEntity(selected);
    setError(null);
  }

  function payload(dryRun: boolean) {
    if (!entity) throw new Error("Kies een entiteit");

    return {
      dry_run: dryRun,
      entiteit_id: entity.id,
      peildatum: form.date,
      rekeningen: entity.accounts.map((account) => ({
        rekening_id: account.id,
        saldo: parseNumber(form.balances[account.id] ?? ""),
      })),
      vrije_ruimte_restsaldo:
        entity.freeRoom == null
          ? null
          : parseNumber(form.freeRoomRemaining),
      toelichting: form.note.trim() || null,
    };
  }

  async function send(dryRun: boolean, event?: FormEvent) {
    event?.preventDefault();
    if (!entity) return;

    if (!form.date) {
      setError("Peildatum is verplicht.");
      return;
    }

    if (nextAllowedDate && form.date < nextAllowedDate) {
      setError(
        `Nieuwe peildatum moet minimaal ${dateNl(nextAllowedDate)} zijn.`
      );
      return;
    }

    for (const account of entity.accounts) {
      if (
        !Number.isFinite(
          parseNumber(form.balances[account.id] ?? "")
        )
      ) {
        setError(`Saldo voor ${account.name} is ongeldig.`);
        return;
      }
    }

    if (
      entity.freeRoom &&
      !Number.isFinite(parseNumber(form.freeRoomRemaining))
    ) {
      setError("Resterende vrije ruimte is ongeldig.");
      return;
    }

    if (
      !dryRun &&
      !window.confirm(
        `Nieuwe werkelijke stand voor ${entity.name} activeren per ${dateNl(
          form.date
        )}? Vanaf dat moment rekent de basisprognose verder vanaf deze rekeningstanden.`
      )
    ) {
      return;
    }

    setBusy(dryRun ? "check" : "save");
    setError(null);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/cashflow/saldi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload(dryRun)),
      });
      const json = (await res.json()) as ApiResponse;

      if (!res.ok || !json.success) {
        throw new Error(json.error || `Verwerking mislukt (${res.status})`);
      }

      if (dryRun) {
        setLastCheck(json.checked ?? null);
        setMessage(
          "Controle geslaagd. Er is niets opgeslagen en de prognose is niet gewijzigd."
        );
      } else {
        setLastCheck(null);
        setMessage(
          `${entity.name}: nieuwe prognosebasis per ${dateNl(
            json.saved?.newDate
          )} is geactiveerd.`
        );
        await load(entity.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verwerking mislukt.");
    } finally {
      setBusy(null);
    }
  }

  async function restoreSnapshot(row: History, dryRun: boolean) {
    if (!entity) return;

    if (
      !dryRun &&
      !window.confirm(
        `Snapshot van ${dateNl(
          row.date
        )} herstellen als actieve prognosebasis voor ${entity.name}? De huidige actieve stand wordt niet uit de historie verwijderd.`
      )
    ) {
      return;
    }

    setError(null);
    setMessage(null);
    setRestoreBusyId(row.id);

    try {
      const res = await fetch("/api/admin/cashflow/saldi", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshot_id: row.id,
          dry_run: dryRun,
        }),
      });
      const json = (await res.json()) as ApiResponse;

      if (!res.ok || !json.success) {
        throw new Error(json.error || `Herstel mislukt (${res.status})`);
      }

      if (dryRun) {
        setRestoreCheckId(row.id);
        setMessage(
          `Herstelcontrole geslaagd voor ${entity.name} · ${dateNl(
            row.date
          )}. Er is niets gewijzigd.`
        );
      } else {
        setRestoreCheckId(null);
        setMessage(
          `${entity.name}: snapshot van ${dateNl(
            row.date
          )} is hersteld als actieve prognosebasis.`
        );
        await load(entity.id);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Snapshot herstellen mislukt."
      );
    } finally {
      setRestoreBusyId(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                Cashflow · fase 4L-C
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                Actuele saldi & peildatum
              </h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Leg periodiek de werkelijke rekeningstanden vast. Vanaf een
                nieuwe peildatum rekent de basisprognose verder vanaf de nieuwe
                werkelijkheid.
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

        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950 shadow-sm">
          <div className="font-semibold">Waarvoor gebruik je dit scherm?</div>
          <p className="mt-1 leading-6">
            Hier leg je de <strong>werkelijke banksaldi</strong> vast en bepaal
            je de nieuwe <strong>peildatum</strong>. Tot en met die datum is dit
            de actuele werkelijkheid; daarna rekent de cashflowprognose verder.
            Na een winterstop of langere pauze is dit het eerste cashflowscherm
            dat je controleert.
          </p>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold">
            <a
              href="/admin/infotheek/jaarstart-cashflow-wat-controleer-je-na-de-winterstop"
              className="text-emerald-800 underline decoration-emerald-400 underline-offset-2 hover:text-emerald-950"
            >
              📖 Jaarstart / na de winterstop
            </a>
            <a
              href="/admin/infotheek/hoe-lopen-de-geldstromen-tussen-vincenzo-holdings-en-prive"
              className="text-emerald-800 underline decoration-emerald-400 underline-offset-2 hover:text-emerald-950"
            >
              📖 Uitleg vrije ruimte en geldstromen
            </a>
          </div>
        </section>

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 shadow-sm">
          <span className="font-semibold">Maandultimo.</span>{" "}
          De cashflowmotor rekent per hele kalendermaand. Daarom kan een nieuwe
          werkelijke peildatum alleen op de laatste dag van een maand worden
          geactiveerd. Met <strong>Controleer zonder opslaan</strong> kun je een
          toekomstige maandultimo nu al technisch testen.
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
            Saldi worden geladen…
          </section>
        ) : (
          <>
            <section className="grid gap-5 lg:grid-cols-[300px_1fr]">
              <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">
                  Entiteiten
                </h2>

                <div className="mt-4 space-y-2">
                  {(data?.entities ?? []).map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => chooseEntity(row.id)}
                      className={`w-full rounded-xl border p-3 text-left ${
                        row.id === entityId
                          ? "border-emerald-300 bg-emerald-50"
                          : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                      }`}
                    >
                      <div className="font-semibold text-slate-900">
                        {row.name}
                      </div>
                      <div className="mt-1 text-xs text-slate-500">
                        Peildatum {dateNl(row.currentDate)}
                      </div>
                      <div className="mt-1 text-sm font-bold tabular-nums text-slate-800">
                        {euro(row.currentTotal)}
                      </div>
                    </button>
                  ))}
                </div>
              </aside>

              {entity && (
                <form
                  onSubmit={(event) => send(false, event)}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                        {entity.type === "werkmaatschappij"
                          ? "Werkmaatschappij"
                          : "Holding"}
                      </div>
                      <h2 className="mt-1 text-2xl font-bold text-slate-900">
                        {entity.name}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Huidige basis {dateNl(entity.currentDate)} ·{" "}
                        {euro(entity.currentTotal)}
                      </p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Nieuwe totaalstand
                      </div>
                      <div className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                        {euro(enteredTotal)}
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <Field label="Nieuwe peildatum *">
                      <input
                        type="date"
                        min={nextAllowedDate}
                        value={form.date}
                        onChange={(e) => {
                          setForm((prev) => ({
                            ...prev,
                            date: e.target.value,
                          }));
                          setLastCheck(null);
                        }}
                        className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                      />
                      <div className="mt-1 text-xs text-slate-500">
                        Eerstvolgende mogelijke datum:{" "}
                        {dateNl(nextAllowedDate)}
                      </div>
                      <div className="mt-1 text-xs leading-5 text-slate-500">
                        Tot en met deze peildatum leg je de werkelijke stand vast;
                        de prognose rekent daarna verder.
                      </div>
                    </Field>

                    {entity.accounts.map((account) => (
                      <Field
                        key={account.id}
                        label={`${account.name} *`}
                      >
                        <MoneyInput
                          value={form.balances[account.id] ?? ""}
                          onChange={(value) => {
                            setForm((prev) => ({
                              ...prev,
                              balances: {
                                ...prev.balances,
                                [account.id]: value,
                              },
                            }));
                            setLastCheck(null);
                          }}
                        />
                        <div className="mt-1 text-xs text-slate-500">
                          Huidig {euro(account.balance)}
                        </div>
                      </Field>
                    ))}

                    {entity.freeRoom && (
                      <Field label="Resterende vrije ruimte *">
                        <MoneyInput
                          value={form.freeRoomRemaining}
                          onChange={(value) => {
                            setForm((prev) => ({
                              ...prev,
                              freeRoomRemaining: value,
                            }));
                            setLastCheck(null);
                          }}
                        />
                        <div className="mt-1 text-xs text-slate-500">
                          Huidig {euro(entity.freeRoom.remaining)}
                        </div>
                        <div className="mt-1 text-xs leading-5 text-slate-500">
                          Dit is de resterende vrije ruimte/rekening-courantruimte.
                          Het is niet hetzelfde als het banksaldo of de gewenste
                          privé-opname.
                        </div>
                      </Field>
                    )}

                    <Field label="Toelichting">
                      <input
                        type="text"
                        value={form.note}
                        onChange={(e) =>
                          setForm((prev) => ({
                            ...prev,
                            note: e.target.value,
                          }))
                        }
                        placeholder="optioneel"
                        className="h-11 w-full rounded-xl border border-slate-300 px-3 text-sm"
                      />
                    </Field>
                  </div>

                  {lastCheck && (
                    <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                      <div className="font-semibold">
                        Technische controle geslaagd
                      </div>
                      <div className="mt-1">
                        {dateNl(lastCheck.previousDate)} →{" "}
                        {dateNl(lastCheck.newDate)} · totaal{" "}
                        {euro(lastCheck.total)}
                        {lastCheck.freeRoomRemaining != null
                          ? ` · vrije ruimte ${euro(
                              lastCheck.freeRoomRemaining
                            )}`
                          : ""}
                        .
                      </div>
                      <div className="mt-1 text-xs">
                        De transactie is volledig uitgevoerd en daarna
                        teruggedraaid; er is niets opgeslagen.
                      </div>
                    </div>
                  )}

                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={() => send(true)}
                      disabled={busy !== null}
                      className="h-11 rounded-xl border border-emerald-300 bg-emerald-50 px-5 text-sm font-semibold text-emerald-800 disabled:opacity-50"
                    >
                      {busy === "check"
                        ? "Controleren…"
                        : "Controleer zonder opslaan"}
                    </button>

                    <button
                      type="submit"
                      disabled={busy !== null || !canActivate}
                      className="h-11 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {busy === "save"
                        ? "Activeren…"
                        : "Nieuwe peildatum activeren"}
                    </button>
                  </div>

                  {!canActivate && form.date && form.date > today && (
                    <div className="mt-2 text-xs font-medium text-amber-700">
                      Deze datum ligt nog in de toekomst. Je kunt hem nu wel
                      technisch controleren, maar pas op of na{" "}
                      {dateNl(form.date)} echt activeren.
                    </div>
                  )}
                </form>
              )}
            </section>

            {entity && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-xl font-bold text-slate-900">
                  Snapshot-historie · {entity.name}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Iedere geactiveerde peildatum blijft bewaard. Een eerdere snapshot kan gecontroleerd worden hersteld.
                </p>

                <div className="mt-4 overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                        <th className="pb-2 pr-4">Peildatum</th>
                        <th className="pb-2 pr-4 text-right">Totaal</th>
                        <th className="pb-2 pr-4 text-right">
                          Vrije ruimte
                        </th>
                        <th className="pb-2 pr-4">Bron</th>
                        <th className="pb-2 pr-4">Status / herstel</th>
                        <th className="pb-2">Rekeningen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((row) => (
                        <tr
                          key={row.id}
                          className="border-b border-slate-100 last:border-0"
                        >
                          <td className="py-3 pr-4 font-semibold text-slate-900">
                            {dateNl(row.date)}
                          </td>
                          <td className="py-3 pr-4 text-right font-semibold tabular-nums">
                            {euro(row.total)}
                          </td>
                          <td className="py-3 pr-4 text-right tabular-nums">
                            {row.freeRoomRemaining == null
                              ? "—"
                              : euro(row.freeRoomRemaining)}
                          </td>
                          <td className="py-3 pr-4 text-slate-600">
                            {row.source}
                          </td>
                          <td className="py-3 pr-4">
                            {row.date === entity.currentDate ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
                                  Actief
                                </span>
                                <button
                                  type="button"
                                  onClick={() => restoreSnapshot(row, true)}
                                  disabled={restoreBusyId !== null}
                                  className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-50"
                                >
                                  {restoreBusyId === row.id
                                    ? "Controleren…"
                                    : restoreCheckId === row.id
                                      ? "Controle herstel ✓"
                                      : "Controle herstel"}
                                </button>
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => restoreSnapshot(row, true)}
                                  disabled={restoreBusyId !== null}
                                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 disabled:opacity-50"
                                >
                                  {restoreBusyId === row.id
                                    ? "Controleren…"
                                    : restoreCheckId === row.id
                                      ? "Controle ✓"
                                      : "Controleer herstel"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => restoreSnapshot(row, false)}
                                  disabled={restoreBusyId !== null}
                                  className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
                                >
                                  Herstel deze stand
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="py-3 text-slate-600">
                            {row.accounts
                              .map(
                                (account) =>
                                  `${account.accountName}: ${euro(
                                    Number(account.balance)
                                  )}`
                              )
                              .join(" · ")}
                          </td>
                        </tr>
                      ))}

                      {history.length === 0 && (
                        <tr>
                          <td
                            colSpan={6}
                            className="py-8 text-center text-slate-500"
                          >
                            Nog geen snapshots.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
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
      <div className="mb-1.5 text-sm font-semibold text-slate-700">
        {label}
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
        step="0.01"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-11 w-full rounded-xl border border-slate-300 pl-8 pr-3 text-sm"
      />
    </div>
  );
}
