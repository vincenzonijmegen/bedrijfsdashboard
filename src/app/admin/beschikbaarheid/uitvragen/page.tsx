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
  [key: string]: any;
};

const dagen = [
  ["ma", "Ma"],
  ["di", "Di"],
  ["wo", "Wo"],
  ["do", "Do"],
  ["vr", "Vr"],
  ["za", "Za"],
  ["zo", "Zo"],
];

function fmt(datum?: string | null) {
  if (!datum) return "—";
  return new Date(datum).toLocaleDateString("nl-NL");
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
  const { data: deelnames, mutate: mutateDeelnames } = useSWR<Deelname[]>(
    selectedRondeId ? `/api/beschikbaarheid/uitvragen/${selectedRondeId}/deelnames` : null,
    fetcher
  );

  const selectedRonde = useMemo(
    () => rondes?.find((r) => r.id === selectedRondeId) || rondes?.[0],
    [rondes, selectedRondeId]
  );

  const actieveRondeId = selectedRonde?.id || null;

  const bestaandeEmails = useMemo(() => {
    const set = new Set<string>();
    (deelnames || []).forEach((d) => set.add(d.medewerker_email));
    return set;
  }, [deelnames]);

  const openstaandeEmails = useMemo(
    () => (deelnames || []).filter((d) => d.status !== "ingevuld").map((d) => d.medewerker_email),
    [deelnames]
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

  const teVerzendenEmails = Object.entries(selectedEmails)
    .filter(([, checked]) => checked)
    .map(([email]) => email);

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <Link
                href="/admin/beschikbaarheid"
                className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-900"
              >
                <ArrowLeft size={16} /> Terug naar beschikbaarheid
              </Link>
              <div className="mb-1 flex items-center gap-2 text-sm font-medium text-orange-600">
                <CalendarDays className="h-4 w-4" /> Planning / Beschikbaarheids-opgave
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Beschikbaarheid opvragen
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Maak een uitvraagronde aan en stuur medewerkers een persoonlijke invullink.
              </p>
            </div>

            <button
              onClick={() => setFormOpen((v) => !v)}
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus size={16} /> Nieuwe uitvraag
            </button>
          </div>
        </div>

        {message && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 px-5 py-3 text-sm font-medium text-blue-800">
            {message}
          </div>
        )}

        {formOpen && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-slate-950">Nieuwe uitvraagronde</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                Naam
                <input
                  value={nieuweRonde.naam}
                  onChange={(e) => setNieuweRonde({ ...nieuweRonde, naam: e.target.value })}
                  placeholder="Beschikbaarheid september 2026"
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Deadline
                <input
                  type="date"
                  value={nieuweRonde.deadline}
                  onChange={(e) => setNieuweRonde({ ...nieuweRonde, deadline: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Startdatum periode
                <input
                  type="date"
                  value={nieuweRonde.start_datum}
                  onChange={(e) => setNieuweRonde({ ...nieuweRonde, start_datum: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Einddatum periode
                <input
                  type="date"
                  value={nieuweRonde.eind_datum}
                  onChange={(e) => setNieuweRonde({ ...nieuweRonde, eind_datum: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
              <label className="md:col-span-2 text-sm font-semibold text-slate-700">
                Toelichting voor medewerkers
                <textarea
                  value={nieuweRonde.toelichting}
                  onChange={(e) => setNieuweRonde({ ...nieuweRonde, toelichting: e.target.value })}
                  rows={3}
                  className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
              </label>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                onClick={createRonde}
                disabled={isSaving}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {isSaving && <Loader2 size={16} className="animate-spin" />} Uitvraag opslaan
              </button>
            </div>
          </section>
        )}

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-bold text-slate-950">Uitvragen</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {rondes.length === 0 ? (
                <div className="px-5 py-8 text-sm text-slate-500">Nog geen uitvragen.</div>
              ) : (
                rondes.map((ronde) => (
                  <button
                    key={ronde.id}
                    onClick={() => setSelectedRondeId(ronde.id)}
                    className={`block w-full px-5 py-4 text-left transition hover:bg-slate-50 ${
                      selectedRonde?.id === ronde.id ? "bg-blue-50" : ""
                    }`}
                  >
                    <div className="font-semibold text-slate-950">{ronde.naam}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {fmt(ronde.start_datum)} – {fmt(ronde.eind_datum)}
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                      <span className="rounded-lg bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">
                        {ronde.aantal_ingevuld} ingevuld
                      </span>
                      <span className="rounded-lg bg-orange-50 px-2 py-1 font-semibold text-orange-700">
                        {ronde.aantal_uitgesteld} uitgesteld
                      </span>
                      <span className="rounded-lg bg-slate-100 px-2 py-1 font-semibold text-slate-700">
                        {ronde.aantal_open} open
                      </span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </section>

          <section className="space-y-6">
            {selectedRonde ? (
              <>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-slate-950">{selectedRonde.naam}</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Periode {fmt(selectedRonde.start_datum)} – {fmt(selectedRonde.eind_datum)} · deadline {fmt(selectedRonde.deadline)}
                      </p>
                      {selectedRonde.toelichting && (
                        <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                          {selectedRonde.toelichting}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => verzendMails(openstaandeEmails, true)}
                      disabled={isSaving || openstaandeEmails.length === 0}
                      className="inline-flex h-10 items-center gap-2 rounded-xl border border-orange-200 bg-orange-50 px-4 text-sm font-semibold text-orange-700 hover:bg-orange-100 disabled:opacity-50"
                    >
                      <Send size={16} /> Herinner openstaand
                    </button>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-3 flex items-center gap-2 font-bold text-slate-950">
                    <Users size={18} /> Medewerkers mailen
                  </h3>
                  <div className="mb-3 flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        const next: Record<string, boolean> = {};
                        medewerkers.forEach((m) => {
                          if (!bestaandeEmails.has(m.email)) next[m.email] = true;
                        });
                        setSelectedEmails(next);
                      }}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Selecteer nog niet gekoppeld
                    </button>
                    <button
                      onClick={() => setSelectedEmails({})}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Selectie wissen
                    </button>
                  </div>
                  <div className="max-h-64 overflow-auto rounded-xl border border-slate-200">
                    {medewerkers.map((m) => (
                      <label key={m.email} className="flex items-center gap-3 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0">
                        <input
                          type="checkbox"
                          checked={!!selectedEmails[m.email]}
                          onChange={(e) => setSelectedEmails({ ...selectedEmails, [m.email]: e.target.checked })}
                        />
                        <span className="flex-1 font-medium text-slate-800">{m.naam}</span>
                        {bestaandeEmails.has(m.email) && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-500">
                            al gekoppeld
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                  <div className="mt-4 flex justify-end">
                    <button
                      onClick={() => verzendMails(teVerzendenEmails)}
                      disabled={isSaving || teVerzendenEmails.length === 0}
                      className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                      <Mail size={16} /> Verstuur {teVerzendenEmails.length || ""} mail(s)
                    </button>
                  </div>
                </div>

                <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="border-b border-slate-200 px-5 py-4">
                    <h3 className="font-bold text-slate-950">Status en antwoorden</h3>
                  </div>
                  {!deelnames ? (
                    <div className="px-5 py-8 text-sm text-slate-500">Deelnames laden…</div>
                  ) : deelnames.length === 0 ? (
                    <div className="px-5 py-8 text-sm text-slate-500">Nog geen medewerkers gekoppeld.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-4 py-3 text-left">Naam</th>
                            <th className="px-4 py-3 text-left">Status</th>
                            {dagen.map(([, label]) => (
                              <th key={label} className="px-2 py-3 text-center">{label}</th>
                            ))}
                            <th className="px-4 py-3 text-center">Max</th>
                            <th className="px-4 py-3 text-left">Toelichting</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {deelnames.map((d) => (
                            <tr key={d.id} className="hover:bg-slate-50">
                              <td className="px-4 py-3 font-semibold text-slate-900">{d.naam}</td>
                              <td className="px-4 py-3">
                                {d.status === "ingevuld" ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                                    <CheckCircle2 size={13} /> ingevuld
                                  </span>
                                ) : d.status === "uitgesteld" ? (
                                  <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-700">
                                    <Clock3 size={13} /> {fmt(d.herinner_mij_op)}
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                                    open
                                  </span>
                                )}
                              </td>
                              {dagen.map(([key]) => (
                                <td key={`${d.id}-${key}`} className="px-2 py-3 text-center text-xs">
                                  <span className={d[`${key}_shift_1`] ? "font-bold text-emerald-600" : "text-slate-300"}>
                                    {d[`${key}_shift_1`] ? "1" : "—"}
                                  </span>
                                  <span className="mx-1 text-slate-300">/</span>
                                  <span className={d[`${key}_shift_2`] ? "font-bold text-emerald-600" : "text-slate-300"}>
                                    {d[`${key}_shift_2`] ? "2" : "—"}
                                  </span>
                                </td>
                              ))}
                              <td className="px-4 py-3 text-center">{d.max_diensten_per_week || "—"}</td>
                              <td className="max-w-xs px-4 py-3 text-slate-600">{d.toelichting || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white px-5 py-10 text-center text-sm text-slate-500 shadow-sm">
                Maak eerst een uitvraag aan.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
