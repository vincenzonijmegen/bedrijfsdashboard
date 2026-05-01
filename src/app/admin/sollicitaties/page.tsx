"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  Briefcase,
  CalendarDays,
  Mail,
  Phone,
  Search,
  UserRound,
  Users,
} from "lucide-react";

type Sollicitatie = {
  id: number;
  voornaam: string;
  achternaam: string;
  email: string | null;
  telefoon: string | null;
  status: string | null;
  voorkeur_functie: string | null;
  shifts_per_week: string | number | null;
  gesprek_datum: string | null;
  aangemaakt_op: string | null;
};

type AfwijsTemplate = {
  id: number;
  naam: string;
  onderwerp: string;
  html: string;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const statussen = [
  "alle",
  "nieuw",
  "wacht op gegevens",
  "gesprek gepland",
  "uitgenodigd",
  "in de wacht",
  "aangenomen",
  "afgewezen",
];

const statusStyle: Record<string, string> = {
  nieuw: "bg-slate-50 text-slate-700 border-slate-200",
  "wacht op gegevens": "bg-orange-50 text-orange-700 border-orange-200",
  "gesprek gepland": "bg-blue-50 text-blue-700 border-blue-200",
  uitgenodigd: "bg-indigo-50 text-indigo-700 border-indigo-200",
  "in de wacht": "bg-amber-50 text-amber-800 border-amber-200",
  aangenomen: "bg-emerald-50 text-emerald-700 border-emerald-200",
  afgewezen: "bg-red-50 text-red-700 border-red-200",
};

const statusOrder = statussen.filter((s) => s !== "alle");

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("nl-NL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("nl-NL");
}

function vulNaam(html: string, naam: string) {
  return html.replaceAll("{{naam}}", naam);
}

export default function SollicitatiesPage() {
  const { data, mutate } = useSWR<Sollicitatie[]>("/api/sollicitaties", fetcher);
  const { data: templates } = useSWR<AfwijsTemplate[]>(
    "/api/sollicitaties/templates",
    fetcher
  );

  const [statusFilter, setStatusFilter] = useState("alle");
  const [zoekterm, setZoekterm] = useState("");
  const [savingId, setSavingId] = useState<number | null>(null);

  const [afwijsModal, setAfwijsModal] = useState<Sollicitatie | null>(null);
  const [templateId, setTemplateId] = useState<number | "">("");
  const [onderwerp, setOnderwerp] = useState("");
  const [mailtekst, setMailtekst] = useState("");
  const [reden, setReden] = useState("");

  async function updateStatus(id: number, status: string) {
    try {
      setSavingId(id);

      const res = await fetch(`/api/sollicitaties/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Status aanpassen mislukt");
      }

      await mutate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Status aanpassen mislukt");
    } finally {
      setSavingId(null);
    }
  }

  function openAfwijsModal(s: Sollicitatie) {
    setAfwijsModal(s);
    setTemplateId("");
    setOnderwerp("Je sollicitatie bij IJssalon Vincenzo");
    setReden("");
    setMailtekst("");
  }

  function kiesTemplate(idValue: string) {
    const id = Number(idValue);
    const template = templates?.find((t) => t.id === id);

    if (!template || !afwijsModal) {
      setTemplateId("");
      setOnderwerp("");
      setReden("");
      setMailtekst("");
      return;
    }

    const naam = `${afwijsModal.voornaam} ${afwijsModal.achternaam}`.trim();

    setTemplateId(template.id);
    setOnderwerp(template.onderwerp);
    setReden(template.naam);
    setMailtekst(vulNaam(template.html, naam));
  }

  async function verstuurAfwijzing() {
    if (!afwijsModal) return;

    if (!onderwerp.trim()) {
      alert("Vul een onderwerp in.");
      return;
    }

    if (!mailtekst.trim()) {
      alert("Vul een mailtekst in.");
      return;
    }

    if (
      !confirm(
        "Weet je zeker dat je deze afwijsmail wilt versturen? Dit kan niet ongedaan worden gemaakt."
      )
    ) {
      return;
    }

    try {
      setSavingId(afwijsModal.id);

      const res = await fetch("/api/sollicitaties/afwijzen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: afwijsModal.id,
          template_id: templateId || null,
          reden,
          onderwerp,
          mailtekst,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Afwijzen mislukt");
      }

      setAfwijsModal(null);
      setTemplateId("");
      setOnderwerp("");
      setMailtekst("");
      setReden("");

      await mutate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Afwijzen mislukt");
    } finally {
      setSavingId(null);
    }
  }

  const sollicitaties = data || [];

  const counts = useMemo(() => {
    return statussen.reduce<Record<string, number>>((acc, status) => {
      if (status === "alle") {
        acc[status] = sollicitaties.length;
      } else {
        acc[status] = sollicitaties.filter(
          (s) => (s.status || "nieuw") === status
        ).length;
      }

      return acc;
    }, {});
  }, [sollicitaties]);

  const gefilterd = useMemo(() => {
    const q = zoekterm.trim().toLowerCase();

    return sollicitaties
      .filter((s) => {
        const status = s.status || "nieuw";
        const statusOk = statusFilter === "alle" || status === statusFilter;

        const zoekOk =
          !q ||
          `${s.voornaam} ${s.achternaam}`.toLowerCase().includes(q) ||
          String(s.email || "").toLowerCase().includes(q) ||
          String(s.telefoon || "").toLowerCase().includes(q);

        return statusOk && zoekOk;
      })
      .sort((a, b) => {
        const statusA = a.status || "nieuw";
        const statusB = b.status || "nieuw";

        return (
          statusOrder.indexOf(statusA) - statusOrder.indexOf(statusB) ||
          new Date(b.aangemaakt_op || 0).getTime() -
            new Date(a.aangemaakt_op || 0).getTime()
        );
      });
  }, [sollicitaties, statusFilter, zoekterm]);

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Sollicitaties laden...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-6xl space-y-5 p-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                <Users size={14} />
                Personeel
              </div>

              <h1 className="text-2xl font-bold text-slate-900">
                Sollicitaties
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Overzicht van kandidaten, gesprekken en vervolgstappen.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
              <div className="text-2xl font-bold text-slate-900">
                {counts.alle || 0}
              </div>
              <div className="text-xs font-medium text-slate-500">
                sollicitaties totaal
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 md:grid-cols-[1fr_260px]">
            <div className="relative">
              <Search
                size={17}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={zoekterm}
                onChange={(e) => setZoekterm(e.target.value)}
                placeholder="Zoeken op naam, e-mail of telefoon..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-9 pr-3 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
            >
              {statussen.map((status) => (
                <option key={status} value={status}>
                  {status === "alle"
                    ? `Alle sollicitaties (${counts.alle || 0})`
                    : `${formatStatus(status)} (${counts[status] || 0})`}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {statussen.map((status) => {
              const active = statusFilter === status;

              return (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-blue-600 bg-blue-600 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
                  }`}
                >
                  {status === "alle" ? "Alle" : formatStatus(status)} ·{" "}
                  {counts[status] || 0}
                </button>
              );
            })}
          </div>
        </section>

        <section className="space-y-3">
          {gefilterd.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
              Geen sollicitaties gevonden.
            </div>
          ) : (
            gefilterd.map((s) => {
              const status = s.status || "nieuw";
              const fullName = `${s.voornaam} ${s.achternaam}`.trim();

              return (
                <article
                  key={s.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                          <UserRound size={20} />
                        </div>

                        <div>
                          <Link
                            href={`/admin/sollicitaties/${s.id}`}
                            className="text-lg font-bold text-slate-900 hover:text-blue-700"
                          >
                            {fullName || "Naam onbekend"}
                          </Link>

                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                statusStyle[status] ||
                                "border-slate-200 bg-slate-50 text-slate-700"
                              }`}
                            >
                              {formatStatus(status)}
                            </span>

                            <span className="text-xs text-slate-400">
                              Binnengekomen: {formatDate(s.aangemaakt_op)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-2 text-sm text-slate-600 md:grid-cols-2">
                        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                          <Mail size={15} className="text-slate-400" />
                          <span className="truncate">{s.email || "-"}</span>
                        </div>

                        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                          <Phone size={15} className="text-slate-400" />
                          <span>{s.telefoon || "-"}</span>
                        </div>

                        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                          <Briefcase size={15} className="text-slate-400" />
                          <span>Functie: {s.voorkeur_functie || "-"}</span>
                        </div>

                        <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
                          <CalendarDays size={15} className="text-slate-400" />
                          <span>
                            Gesprek:{" "}
                            {s.gesprek_datum
                              ? formatDateTime(s.gesprek_datum)
                              : "-"}
                          </span>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2 text-xs">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-medium text-slate-600">
                          Shifts: {s.shifts_per_week || "-"}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 md:min-w-60">
                      <select
                        value={status}
                        onChange={(e) => updateStatus(s.id, e.target.value)}
                        disabled={savingId === s.id}
                        className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
                      >
                        <option value="nieuw">Nieuw</option>
                        <option value="wacht op gegevens">
                          Wacht op gegevens
                        </option>
                        <option value="gesprek gepland">Gesprek gepland</option>
                        <option value="uitgenodigd">Uitgenodigd</option>
                        <option value="in de wacht">In de wacht</option>
                        <option value="aangenomen">Aangenomen</option>
                        <option value="afgewezen">Afgewezen</option>
                      </select>

                      <div className="flex gap-2">
                        <Link
                          href={`/admin/sollicitaties/${s.id}`}
                          className="flex-1 rounded-xl bg-blue-600 px-3 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                        >
                          Openen
                        </Link>

                        {status !== "afgewezen" && (
                          <button
                            onClick={() => openAfwijsModal(s)}
                            disabled={savingId === s.id}
                            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                          >
                            Afwijzen
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>

        {afwijsModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
            <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
              <div className="mb-4 border-b border-slate-100 pb-4">
                <h2 className="text-lg font-bold text-slate-900">
                  Afwijsmail versturen
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Kandidaat: {afwijsModal.voornaam} {afwijsModal.achternaam}
                </p>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Reden / sjabloon
                  </label>
                  <select
                    value={templateId}
                    onChange={(e) => kiesTemplate(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="">Kies een reden...</option>
                    {(templates || []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.naam}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Onderwerp
                  </label>
                  <input
                    value={onderwerp}
                    onChange={(e) => setOnderwerp(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold text-slate-700">
                    Mailtekst
                  </label>
                  <textarea
                    value={mailtekst}
                    onChange={(e) => setMailtekst(e.target.value)}
                    className="h-64 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-mono outline-none transition focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    HTML is toegestaan. De tekst wordt exact zo opgeslagen en
                    verstuurd.
                  </p>
                </div>
              </div>

              <div className="mt-5 flex justify-between gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setAfwijsModal(null);
                    setTemplateId("");
                    setOnderwerp("");
                    setMailtekst("");
                    setReden("");
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Annuleren
                </button>

                <button
                  type="button"
                  onClick={verstuurAfwijzing}
                  disabled={savingId === afwijsModal.id}
                  className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-50"
                >
                  {savingId === afwijsModal.id
                    ? "Versturen..."
                    : "Afwijsmail versturen"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}