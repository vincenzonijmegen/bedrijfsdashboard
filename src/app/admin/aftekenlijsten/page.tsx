// src/app/admin/aftekenlijsten/page.tsx
"use client";

import Link from "next/link";
import useSWR from "swr";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import ScrollToTopButton from "@/components/ScrollToTopButton";

type Categorie =
  | "winkel-begin"
  | "winkel-eind"
  | "keuken-begin"
  | "keuken-eind"
  | "inspectierapporten"
  | "incidenteel";

// API-row (ingevuld + template)
type Row = {
  id: number;
  categorie: Categorie | string;
  week: number | null;     // 👈 kan null zijn bij templates
  jaar: number | null;     // 👈 kan null zijn bij templates
  opmerking?: string | null;
  bestand_url?: string | null;
  is_template?: boolean;   // 👈 nieuw
  template_naam?: string | null; // 👈 nieuw
  ext?: string | null;           // 👈 nieuw
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const API_PATH = "/api/aftekenlijsten?type=all"; // 👈 alles ophalen

const categorieNamen: Record<string, string> = {
  "winkel-begin": "Winkel – begin",
  "winkel-eind": "Winkel – eind",
  "keuken-begin": "Keuken – begin",
  "keuken-eind": "Keuken – eind",
  inspectierapporten: "Inspectierapporten",
  incidenteel: "Incidenteel",
};

const HACCP_CAT_ORDER: string[] = [
  "keuken-begin",
  "keuken-eind",
  "winkel-begin",
  "winkel-eind",
];

export default function Pagina() {
  const { data, isLoading, mutate } = useSWR<Row[]>(API_PATH, fetcher);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // ✅ standaard ingeklapt
  const [openHaccp, setOpenHaccp] = useState(false);
  const [openInspectie, setOpenInspectie] = useState(false);
  const [openIncidenteel, setOpenIncidenteel] = useState(false);
  const [openTemplates, setOpenTemplates] = useState(true); // templates standaard open

  const currentYear = useMemo(() => new Date().getFullYear(), []);

  if (isLoading || !data) {
    return (
      <main className="p-6">
        <Header currentYear={currentYear} />
        Laden…
      </main>
    );
  }

  // Split naar ingevuld vs templates
  const ingevuld = data.filter((d) => !d.is_template);
  const templates = data.filter((d) => !!d.is_template);

  // Bestaande secties (alleen ingevuld)
  const inspectierapporten = ingevuld.filter((d) => d.categorie === "inspectierapporten");
  const incidenteel = ingevuld.filter((d) => d.categorie === "incidenteel");
  const haccp = ingevuld.filter(
    (d) => d.categorie !== "incidenteel" && d.categorie !== "inspectierapporten"
  );

  // HACCP sortering: nieuw→oud op jaar/week, daarna categorievolgorde, daarna id nieuw→oud
  const haccpSorted = haccp
    .slice()
    .sort((a, b) => {
      const bj = (b.jaar ?? 0) - (a.jaar ?? 0);
      if (bj !== 0) return bj;
      const bw = (b.week ?? 0) - (a.week ?? 0);
      if (bw !== 0) return bw;
      const pa = HACCP_CAT_ORDER.indexOf(String(a.categorie));
      const pb = HACCP_CAT_ORDER.indexOf(String(b.categorie));
      if (pa !== pb) return pa - pb;
      return b.id - a.id;
    });

  async function handleDelete(id: number) {
    if (!confirm("Weet je zeker dat je dit item wilt verwijderen?")) return;
    setDeletingId(id);
    try {
      const res = await fetch("/api/aftekenlijsten", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) {
        const t = await res.text();
        console.error("Delete failed:", t);
      }
      mutate();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="p-6 space-y-8">
      <Header currentYear={currentYear} />

      {/* Lege formulieren (templates) */}
      <Section
        title="Lege formulieren (templates)"
        open={openTemplates}
        onToggle={() => setOpenTemplates((v) => !v)}
      >
        {templates.length > 0 ? (
          <TabelTemplates
            rows={templates}
            onDelete={handleDelete}
            deletingId={deletingId}
          />
        ) : (
          <LegeState />
        )}
      </Section>

      {/* HACCP (ingevuld) */}
      <Section
        title="HACCP-lijsten"
        open={openHaccp}
        onToggle={() => setOpenHaccp((v) => !v)}
      >
        {haccpSorted.length === 0 ? (
          <LegeState />
        ) : (
          <TabelIngevuld
            rows={haccpSorted}
            onDelete={handleDelete}
            deletingId={deletingId}
            showBestandKolom
          />
        )}
      </Section>

      {/* Inspectierapporten (ingevuld) */}
      <Section
        title="Inspectierapporten"
        open={openInspectie}
        onToggle={() => setOpenInspectie((v) => !v)}
      >
        {inspectierapporten.length > 0 ? (
          <TabelIngevuld
            rows={inspectierapporten}
            onDelete={handleDelete}
            deletingId={deletingId}
            showBestandKolom
          />
        ) : (
          <LegeState />
        )}
      </Section>

      {/* Incidenteel (ingevuld) */}
      <Section
        title="Incidentele lijsten"
        open={openIncidenteel}
        onToggle={() => setOpenIncidenteel((v) => !v)}
      >
        {incidenteel.length > 0 ? (
          <TabelIngevuld
            rows={incidenteel}
            onDelete={handleDelete}
            deletingId={deletingId}
            showBestandKolom
          />
        ) : (
          <LegeState />
        )}
      </Section>

      {/* Niets? */}
      {haccp.length === 0 && inspectierapporten.length === 0 && incidenteel.length === 0 && templates.length === 0 && (
        <div className="text-gray-500">Geen registraties gevonden.</div>
      )}
    </main>
  );
}

/* -------------------- Header met upload-link -------------------- */

function Header({ currentYear }: { currentYear: number }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h1 className="text-xl font-semibold">Aftekenlijsten</h1>
      <Link
        href="/admin/aftekenlijsten/upload"
        className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded shadow hover:bg-blue-700"
      >
        <Plus size={18} /> Nieuwe lijst uploaden
      </Link>
    </div>
  );
}

/* -------------------- UI helpers -------------------- */

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="border rounded-lg">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
      >
        <span className="text-lg font-semibold">{title}</span>
        {open ? <ChevronDown /> : <ChevronRight />}
      </button>
      {open && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}

/* -------------------- Tabellen -------------------- */

function TabelIngevuld({
  rows,
  onDelete,
  deletingId,
  showBestandKolom = true,
}: {
  rows: Row[];
  onDelete: (id: number) => void;
  deletingId: number | null;
  showBestandKolom?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-3 py-2 text-left">Week</th>
            <th className="border px-3 py-2 text-left">Jaar</th>
            {showBestandKolom && <th className="border px-3 py-2 text-left">Bestand</th>}
            <th className="border px-3 py-2 text-left">Actie</th>
            <th className="border px-3 py-2 text-left">Opmerking</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const link =
              r.bestand_url && r.bestand_url.trim().length > 0 ? r.bestand_url : null;
            return (
              <tr key={r.id} className="bg-white">
                <td className="border px-3 py-2">
                  {r.week ?? "—"}
                  <span className="ml-2 text-gray-400">
                    • {categorieNamen[String(r.categorie)] ?? String(r.categorie)}
                  </span>
                </td>
                <td className="border px-3 py-2">{r.jaar ?? "—"}</td>
                {showBestandKolom && (
                  <td className="border px-3 py-2">
                    {link ? (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 underline"
                      >
                        Download
                      </a>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </td>
                )}
                <td className="border px-3 py-2">
                  <button
                    onClick={() => onDelete(r.id)}
                    disabled={deletingId === r.id}
                    className="text-red-600 hover:underline disabled:opacity-50"
                  >
                    {deletingId === r.id ? "Verwijderen…" : "Verwijderen"}
                  </button>
                </td>
                <td className="border px-3 py-2">
                  {(() => {
                    const opm = (r.opmerking ?? "").trim();
                    if (opm) return opm;

                    const url = (r.bestand_url ?? "").trim();
                    if (!url) return "-";
                    try {
                      const u = new URL(url);
                      const name = u.pathname.split("/").filter(Boolean).pop() ?? "";
                      return name || "-";
                    } catch {
                      const name = url.split("/").filter(Boolean).pop() ?? "";
                      return name || "-";
                    }
                  })()}
                </td>
              </tr>
            );
          })}

          {rows.length === 0 && (
            <tr>
              <td
                className="border px-3 py-4 text-gray-500"
                colSpan={showBestandKolom ? 5 : 4}
              >
                Geen items.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <ScrollToTopButton />
    </div>
  );
}

function TabelTemplates({
  rows,
  onDelete,
  deletingId,
}: {
  rows: Row[];
  onDelete: (id: number) => void;
  deletingId: number | null;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-3 py-2 text-left">Categorie</th>
            <th className="border px-3 py-2 text-left">Bestand</th>
            <th className="border px-3 py-2 text-left">Actie</th>
            <th className="border px-3 py-2 text-left">Opmerking / Naam</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const link =
              r.bestand_url && r.bestand_url.trim().length > 0 ? r.bestand_url : null;

            // label opmerking/naam
            const naam =
              (r.opmerking ?? "").trim() ||
              (r.template_naam ?? "").trim() ||
              (() => {
                const url = (r.bestand_url ?? "").trim();
                if (!url) return "";
                try {
                  const u = new URL(url);
                  return u.pathname.split("/").filter(Boolean).pop() ?? "";
                } catch {
                  return url.split("/").filter(Boolean).pop() ?? "";
                }
              })();

            return (
              <tr key={r.id} className="bg-white">
                <td className="border px-3 py-2">
                  {categorieNamen[String(r.categorie)] ?? String(r.categorie)}
                </td>
                <td className="border px-3 py-2">
                  {link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 underline"
                    >
                      Download
                    </a>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="border px-3 py-2">
                  <button
                    onClick={() => onDelete(r.id)}
                    disabled={deletingId === r.id}
                    className="text-red-600 hover:underline disabled:opacity-50"
                  >
                    {deletingId === r.id ? "Verwijderen…" : "Verwijderen"}
                  </button>
                </td>
                <td className="border px-3 py-2">{naam || "-"}</td>
              </tr>
            );
          })}

          {rows.length === 0 && (
            <tr>
              <td className="border px-3 py-4 text-gray-500" colSpan={4}>
                Geen items.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <ScrollToTopButton />
    </div>
  );
}

function LegeState() {
  return <div className="text-gray-500 px-1 py-2">Geen items.</div>;
}
