"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";

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
  "uitgenodigd",
  "gesprek gepland",
  "in de wacht",
  "aangenomen",
  "wacht op gegevens",
  "afgewezen",
];

const statusStyle: Record<string, string> = {
  nieuw: "bg-blue-50 text-blue-700 border-blue-200",
  uitgenodigd: "bg-purple-50 text-purple-700 border-purple-200",
  "gesprek gepland": "bg-green-50 text-green-700 border-green-200",
  "in de wacht": "bg-yellow-50 text-yellow-800 border-yellow-200",
  aangenomen: "bg-emerald-50 text-emerald-700 border-emerald-200",
  afgewezen: "bg-red-50 text-red-700 border-red-200",
};

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

  const gefilterd = useMemo(() => {
    const q = zoekterm.trim().toLowerCase();

    return sollicitaties.filter((s) => {
      const status = s.status || "nieuw";
      const statusOk = statusFilter === "alle" || status === statusFilter;

      const zoekOk =
        !q ||
        `${s.voornaam} ${s.achternaam}`.toLowerCase().includes(q) ||
        String(s.email || "").toLowerCase().includes(q) ||
        String(s.telefoon || "").toLowerCase().includes(q);

      return statusOk && zoekOk;
    });
  }, [sollicitaties, statusFilter, zoekterm]);

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

  if (!data) return <div className="p-6">Sollicitaties laden...</div>;

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Sollicitaties</h1>
        <p className="mt-1 text-sm text-slate-500">
          Overzicht van kandidaten, gesprekken en vervolgstappen.
        </p>
      </div>

      <section className="rounded-2xl border bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1fr_260px]">
          <input
            value={zoekterm}
            onChange={(e) => setZoekterm(e.target.value)}
            placeholder="Zoeken op naam, e-mail of telefoon..."
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {statussen.map((status) => (
              <option key={status} value={status}>
                {status === "alle"
                  ? `Alle sollicitaties (${counts.alle || 0})`
                  : `${status} (${counts[status] || 0})`}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {statussen.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                statusFilter === status
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 bg-slate-50 text-slate-600"
              }`}
            >
              {status === "alle" ? "Alle" : status} · {counts[status] || 0}
            </button>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        {gefilterd.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-white p-6 text-sm text-slate-500">
            Geen sollicitaties gevonden.
          </div>
        ) : (
          gefilterd.map((s) => {
            const status = s.status || "nieuw";
            const fullName = `${s.voornaam} ${s.achternaam}`;

            return (
              <article
                key={s.id}
                className="rounded-2xl border bg-white p-4 shadow-sm"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/admin/sollicitaties/${s.id}`}
                        className="text-lg font-semibold text-slate-900 hover:underline"
                      >
                        {fullName}
                      </Link>

                      <span
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
                          statusStyle[status] ||
                          "border-slate-200 bg-slate-50 text-slate-700"
                        }`}
                      >
                        {status}
                      </span>
                    </div>

                    <div className="text-sm text-slate-600">
                      {s.email || "-"} · {s.telefoon || "-"}
                    </div>

                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">
                        Functie: {s.voorkeur_functie || "-"}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">
                        Shifts: {s.shifts_per_week || "-"}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2.5 py-1">
                        Binnengekomen: {formatDate(s.aangemaakt_op)}
                      </span>
                      {s.gesprek_datum ? (
                        <span className="rounded-full bg-green-100 px-2.5 py-1 text-green-700">
                          Gesprek: {formatDateTime(s.gesprek_datum)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 md:min-w-56">
                    <select
                      value={status}
                      onChange={(e) => updateStatus(s.id, e.target.value)}
                      disabled={savingId === s.id}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="nieuw">Nieuw</option>
                      <option value="uitgenodigd">Uitgenodigd</option>
                      <option value="gesprek gepland">Gesprek gepland</option>
                      <option value="in de wacht">In de wacht</option>
                      <option value="aangenomen">Aangenomen</option>
                      <option value="wacht op gegevens">Wacht op gegevens</option>
                      <option value="afgewezen">Afgewezen</option>
                    </select>

                    <div className="flex gap-2">
                      <Link
                        href={`/admin/sollicitaties/${s.id}`}
                        className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Openen
                      </Link>

                      {status !== "afgewezen" && (
                        <button
                          onClick={() => openAfwijsModal(s)}
                          disabled={savingId === s.id}
                          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-slate-900">
                Afwijsmail versturen
              </h2>
              <p className="text-sm text-slate-500">
                Kandidaat: {afwijsModal.voornaam} {afwijsModal.achternaam}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Reden / sjabloon
                </label>
                <select
                  value={templateId}
                  onChange={(e) => kiesTemplate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
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
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Onderwerp
                </label>
                <input
                  value={onderwerp}
                  onChange={(e) => setOnderwerp(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Mailtekst
                </label>
                <textarea
                  value={mailtekst}
                  onChange={(e) => setMailtekst(e.target.value)}
                  className="h-64 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono"
                />
                <p className="mt-1 text-xs text-slate-500">
                  HTML is toegestaan. De tekst wordt exact zo opgeslagen en
                  verstuurd.
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  setAfwijsModal(null);
                  setTemplateId("");
                  setOnderwerp("");
                  setMailtekst("");
                  setReden("");
                }}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Annuleren
              </button>

              <button
                type="button"
                onClick={verstuurAfwijzing}
                disabled={savingId === afwijsModal.id}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                {savingId === afwijsModal.id
                  ? "Versturen..."
                  : "Afwijsmail versturen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}