"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Loader2,
  Mail,
  Plus,
  Send,
  Users,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type Ronde = {
  id: number;
  naam: string;
  start_datum: string;
  eind_datum: string;
  deadline: string | null;
  toelichting: string | null;
  status: string;
  aantal_deelnemers: number;
  aantal_open: number;
  aantal_ingevuld: number;
  aantal_uitgesteld: number;
};

type Medewerker = {
  id?: number;
  naam: string;
  email: string;
};

type Deelname = {
  id: number;
  medewerker_email: string;
  naam: string;
  status: "open" | "ingevuld" | "uitgesteld" | "gesloten";
  verzonden_op: string | null;
  laatste_herinnering_op: string | null;
  herinner_mij_op: string | null;
  ingevuld_op: string | null;
  max_diensten_per_week: number | null;
  toelichting: string | null;
  ma_shift_1?: boolean | null;
  ma_shift_2?: boolean | null;
  di_shift_1?: boolean | null;
  di_shift_2?: boolean | null;
  wo_shift_1?: boolean | null;
  wo_shift_2?: boolean | null;
  do_shift_1?: boolean | null;
  do_shift_2?: boolean | null;
  vr_shift_1?: boolean | null;
  vr_shift_2?: boolean | null;
  za_shift_1?: boolean | null;
  za_shift_2?: boolean | null;
  zo_shift_1?: boolean | null;
  zo_shift_2?: boolean | null;
};

const dagen = [
  ["ma", "Ma"],
  ["di", "Di"],
  ["wo", "Wo"],
  ["do", "Do"],
  ["vr", "Vr"],
  ["za", "Za"],
  ["zo", "Zo"],
] as const;

function fmt(datum?: string | null) {
  if (!datum) return "—";
  return new Date(datum).toLocaleDateString("nl-NL");
}

function statusPill(status: Deelname["status"], herinnerMijOp?: string | null) {
  if (status === "ingevuld") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
        <CheckCircle2 size={13} /> ingevuld
      </span>
    );
  }

  if (status === "uitgesteld") {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-100">
        <Clock3 size={13} /> {fmt(herinnerMijOp)}
      </span>
    );
  }

  if (status === "gesloten") {
    return (
      <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
        gesloten
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
      open
    </span>
  );
}

function shiftCell(deelname: Deelname, dag: string) {
  const s1 = deelname[`${dag}_shift_1` as keyof Deelname];
  const s2 = deelname[`${dag}_shift_2` as keyof Deelname];

  if (!s1 && !s2) {
    return <span className="text-slate-300">—</span>;
  }

  return (
    <span className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
      {s1 ? "1" : "—"}
      <span className="text-emerald-300">/</span>
      {s2 ? "2" : "—"}
    </span>
  );
}

export default function BeschikbaarheidsUitvragenPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedRondeId, setSelectedRondeId] = useState<number | null>(null);
  const [selectedEmails, setSelectedEmails] = useState<Record<string, boolean>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [nieuweRonde, setNieuweRonde] = useState({
    naam: "",
    start_datum: "",
    eind_datum: "",
    deadline: "",
    toelichting: "",
  });

  const { data: rondes, mutate: mutateRondes } = useSWR<Ronde[]>(
    "/api/beschikbaarheid/uitvragen",
    fetcher
  );
  const { data: medewerkers } = useSWR<Medewerker[]>("/api/medewerkers", fetcher);

  const selectedRonde = useMemo(() => {
    if (!rondes || rondes.length === 0) return null;
    return rondes.find((ronde) => ronde.id === selectedRondeId) || rondes[0];
  }, [rondes, selectedRondeId]);

  const actieveRondeId = selectedRonde?.id || null;

  const { data: deelnames, mutate: mutateDeelnames } = useSWR<Deelname[]>(
    actieveRondeId ? `/api/beschikbaarheid/uitvragen/${actieveRondeId}/deelnames` : null,
    fetcher
  );

  const bestaandeEmails = useMemo(() => {
    const set = new Set<string>();
    (deelnames || []).forEach((deelname) => set.add(deelname.medewerker_email));
    return set;
  }, [deelnames]);

  const openstaandeEmails = useMemo(
    () =>
      (deelnames || [])
        .filter((deelname) => deelname.status !== "ingevuld" && deelname.status !== "gesloten")
        .map((deelname) => deelname.medewerker_email),
    [deelnames]
  );

  const teVerzendenEmails = useMemo(
    () =>
      Object.entries(selectedEmails)
        .filter(([, checked]) => checked)
        .map(([email]) => email),
    [selectedEmails]
  );

  async function createRonde() {
    setIsSaving(true);
    setMessage(null);

    const res = await fetch("/api/beschikbaarheid/uitvragen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nieuweRonde),
    });

    const json = await res.json();
    setIsSaving(false);

    if (!res.ok) {
      setMessage(json.error || "Aanmaken mislukt");
      return;
    }

    setNieuweRonde({ naam: "", start_datum: "", eind_datum: "", deadline: "", toelichting: "" });
    setFormOpen(false);
    setSelectedRondeId(json.id);
    await mutateRondes();
    setMessage("Uitvraag aangemaakt.");
  }

  async function verzendMails(emails: string[], alleenHerinneren = false) {
    if (!actieveRondeId || emails.length === 0) return;

    setIsSaving(true);
    setMessage(null);

    const res = await fetch(`/api/beschikbaarheid/uitvragen/${actieveRondeId}/deelnames`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails, alleenHerinneren }),
    });

    const json = await res.json();
    setIsSaving(false);

    if (!res.ok) {
      setMessage(json.error || "Verzenden mislukt");
      return;
    }

    setSelectedEmails({});
    await mutateDeelnames();
    await mutateRondes();
    setMessage(`${json.verzonden?.length || 0} mail(s) verzonden.`);
  }

  if (!rondes || !medewerkers) {
    return (
      <div className="min-h-screen bg-slate-100 px-6 py-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Beschikbaarheidsuitvragen laden…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Link
                href="/admin/beschikbaarheid"
                className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-900"
              >
                <ArrowLeft size={16} /> Terug naar beschikbaarheid
              </Link>

              <div className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-600">
                <CalendarDays className="h-4 w-4" /> Planning / Beschikbaarheids-opgave
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Beschikbaarheid opvragen
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Maak een uitvraagronde aan, verstuur persoonlijke invullinks en bewaak de reacties.
              </p>
            </div>

            <button
              onClick={() => setFormOpen((value) => !value)}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus size={16} /> Nieuwe uitvraag
            </button>
          </div>
        </header>

        {message && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-3 text-sm font-medium text-blue-800 shadow-sm">
            {message}
          </div>
        )}

        {formOpen && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-950">Nieuwe uitvraagronde</h2>
                <p className="text-sm text-slate-500">
                  Bijvoorbeeld voor september, herfstvakantie of een aangepaste schoolperiode.
                </p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                Naam
                <input
                  value={nieuweRonde.naam}
                  onChange={(e) => setNieuweRonde({ ...nieuweRonde, naam: e.target.value })}
                  placeholder="Beschikbaarheid september 2026"
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm shadow-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Deadline
                <input
                  type="date"
                  value={nieuweRonde.deadline}
                  onChange={(e) => setNieuweRonde({ ...nieuweRonde, deadline: e.target.value })}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm shadow-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Startdatum periode
                <input
                  type="date"
                  value={nieuweRonde.start_datum}
                  onChange={(e) => setNieuweRonde({ ...nieuweRonde, start_datum: e.target.value })}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm shadow-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700">
                Einddatum periode
                <input
                  type="date"
                  value={nieuweRonde.eind_datum}
                  onChange={(e) => setNieuweRonde({ ...nieuweRonde, eind_datum: e.target.value })}
                  className="mt-1 h-11 w-full rounded-xl border border-slate-200 px-3 text-sm shadow-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                />
              </label>

              <label className="text-sm font-semibold text-slate-700 md:col-span-2">
                Toelichting voor medewerkers
                <textarea
                  value={nieuweRonde.toelichting}
                  onChange={(e) => setNieuweRonde({ ...nieuweRonde, toelichting: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm shadow-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                />
              </label>
            </div>

            <div className="mt-4 flex justify-end">
              <button
                onClick={createRonde}
                disabled={isSaving}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving && <Loader2 size={16} className="animate-spin" />} Uitvraag opslaan
              </button>
            </div>
          </section>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="h-fit overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <h2 className="font-bold text-slate-950">Uitvragen</h2>
              <p className="mt-1 text-xs text-slate-500">Selecteer een ronde om reacties te bekijken.</p>
            </div>

            <div className="max-h-[520px] overflow-auto p-3">
              {rondes.length === 0 ? (
                <div className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  Nog geen uitvragen.
                </div>
              ) : (
                <div className="space-y-2">
                  {rondes.map((ronde) => {
                    const actief = selectedRonde?.id === ronde.id;

                    return (
                      <button
                        key={ronde.id}
                        onClick={() => setSelectedRondeId(ronde.id)}
                        className={`w-full rounded-xl border px-4 py-3 text-left transition ${
                          actief
                            ? "border-blue-200 bg-blue-50 shadow-sm ring-1 ring-blue-100"
                            : "border-slate-200 bg-white hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="truncate font-semibold text-slate-950">{ronde.naam}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {fmt(ronde.start_datum)} – {fmt(ronde.eind_datum)}
                            </div>
                          </div>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            {ronde.status}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-[11px]">
                          <span className="rounded-lg bg-emerald-50 px-1.5 py-1 font-semibold text-emerald-700">
                            {ronde.aantal_ingevuld} klaar
                          </span>
                          <span className="rounded-lg bg-amber-50 px-1.5 py-1 font-semibold text-amber-700">
                            {ronde.aantal_uitgesteld} later
                          </span>
                          <span className="rounded-lg bg-blue-50 px-1.5 py-1 font-semibold text-blue-700">
                            {ronde.aantal_open} open
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <main className="min-w-0 space-y-6">
            {selectedRonde ? (
              <>
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-xl font-bold text-slate-950">{selectedRonde.naam}</h2>
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 ring-1 ring-blue-100">
                          {selectedRonde.status}
                        </span>
                      </div>

                      <p className="mt-1 text-sm text-slate-500">
                        Periode {fmt(selectedRonde.start_datum)} – {fmt(selectedRonde.eind_datum)} · deadline {fmt(selectedRonde.deadline)}
                      </p>

                      <div className="mt-4 grid gap-3 sm:grid-cols-4">
                        <div className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-slate-100">
                          <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Totaal</div>
                          <div className="mt-1 text-2xl font-bold text-slate-950">{selectedRonde.aantal_deelnemers}</div>
                        </div>
                        <div className="rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
                          <div className="text-xs font-semibold uppercase tracking-wide text-emerald-600">Ingevuld</div>
                          <div className="mt-1 text-2xl font-bold text-emerald-800">{selectedRonde.aantal_ingevuld}</div>
                        </div>
                        <div className="rounded-xl bg-blue-50 px-4 py-3 ring-1 ring-blue-100">
                          <div className="text-xs font-semibold uppercase tracking-wide text-blue-600">Open</div>
                          <div className="mt-1 text-2xl font-bold text-blue-800">{selectedRonde.aantal_open}</div>
                        </div>
                        <div className="rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-100">
                          <div className="text-xs font-semibold uppercase tracking-wide text-amber-600">Uitgesteld</div>
                          <div className="mt-1 text-2xl font-bold text-amber-800">{selectedRonde.aantal_uitgesteld}</div>
                        </div>
                      </div>

                      {selectedRonde.toelichting && (
                        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600">
                          {selectedRonde.toelichting}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => verzendMails(openstaandeEmails, true)}
                      disabled={isSaving || openstaandeEmails.length === 0}
                      className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 text-sm font-semibold text-amber-700 shadow-sm transition hover:bg-amber-100 disabled:opacity-50"
                    >
                      <Send size={16} /> Herinner openstaand
                    </button>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="flex items-center gap-2 font-bold text-slate-950">
                          <Users size={18} /> Medewerkers mailen
                        </h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Selecteer medewerkers en verstuur een persoonlijke invullink.
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => {
                            const next: Record<string, boolean> = {};
                            medewerkers.forEach((medewerker) => {
                              if (!bestaandeEmails.has(medewerker.email)) next[medewerker.email] = true;
                            });
                            setSelectedEmails(next);
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                          Selecteer nieuw
                        </button>
                        <button
                          onClick={() => setSelectedEmails({})}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                          Selectie wissen
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="p-5">
                    <div className="max-h-72 overflow-auto rounded-xl border border-slate-200 bg-white">
                      {medewerkers.map((medewerker) => (
                        <label
                          key={medewerker.email}
                          className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-2 text-sm transition last:border-b-0 hover:bg-slate-50"
                        >
                          <input
                            type="checkbox"
                            checked={!!selectedEmails[medewerker.email]}
                            onChange={(e) =>
                              setSelectedEmails({
                                ...selectedEmails,
                                [medewerker.email]: e.target.checked,
                              })
                            }
                            className="h-4 w-4 rounded border-slate-300 text-blue-600"
                          />
                          <span className="min-w-0 flex-1 truncate font-medium text-slate-800">
                            {medewerker.naam}
                          </span>
                          {bestaandeEmails.has(medewerker.email) && (
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                              gekoppeld
                            </span>
                          )}
                        </label>
                      ))}
                    </div>

                    <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <p className="text-sm text-slate-500">
                        {teVerzendenEmails.length} medewerker(s) geselecteerd.
                      </p>
                      <button
                        onClick={() => verzendMails(teVerzendenEmails)}
                        disabled={isSaving || teVerzendenEmails.length === 0}
                        className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
                      >
                        <Mail size={16} /> Verstuur uitnodiging
                      </button>
                    </div>
                  </div>
                </section>

              </>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500 shadow-sm">
                Maak eerst een uitvraag aan.
              </div>
            )}
          </main>
        </div>

        {selectedRonde && (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <h3 className="font-bold text-slate-950">Status en antwoorden</h3>
              <p className="mt-1 text-sm text-slate-500">
                Per medewerker zie je status, maximale diensten en opgegeven beschikbaarheid.
              </p>
            </div>

            {!deelnames ? (
              <div className="px-5 py-8 text-sm text-slate-500">Deelnames laden…</div>
            ) : deelnames.length === 0 ? (
              <div className="px-5 py-8 text-sm text-slate-500">
                Nog geen medewerkers gekoppeld.
              </div>
            ) : (
              <div className="space-y-4 p-5">
                {deelnames.map((deelname) => (
                  <div
                    key={deelname.id}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h4 className="font-semibold text-slate-950">{deelname.naam}</h4>
                          {statusPill(deelname.status, deelname.herinner_mij_op)}
                        </div>

                        <div className="mt-0.5 truncate text-xs text-slate-400">
                          {deelname.medewerker_email}
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
                          {dagen.map(([key, label]) => (
                            <div
                              key={`${deelname.id}-${key}`}
                              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center"
                            >
                              <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                                {label}
                              </div>
                              <div className="mt-1">{shiftCell(deelname, key)}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="w-full rounded-xl border border-slate-200 bg-slate-50 p-4 2xl:w-64">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                            Max per week
                          </span>
                          <span className="inline-flex min-w-8 justify-center rounded-full bg-white px-3 py-1 text-sm font-bold text-slate-800 ring-1 ring-slate-200">
                            {deelname.max_diensten_per_week || "—"}
                          </span>
                        </div>

                        <div className="mt-4 border-t border-slate-200 pt-4">
                          <div className="text-xs font-bold uppercase tracking-wide text-slate-500">
                            Toelichting
                          </div>
                          <p className="mt-1 text-sm leading-5 text-slate-700">
                            {deelname.toelichting || (
                              <span className="text-slate-300">—</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

      </div>
    </div>
  );
}
