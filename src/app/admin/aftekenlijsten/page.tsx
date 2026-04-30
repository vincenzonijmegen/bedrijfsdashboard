// src/app/admin/aftekenlijsten/page.tsx
"use client";

import Link from "next/link";
import useSWR from "swr";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import ScrollToTopButton from "@/components/ScrollToTopButton";

type Categorie =
  | "winkel-begin"
  | "winkel-eind"
  | "keuken-begin"
  | "keuken-eind"
  | "inspectierapporten"
  | "incidenteel";

type Row = {
  id: number;
  categorie: Categorie | string;
  week: number | null;
  jaar: number | null;
  opmerking?: string | null;
  bestand_url?: string | null;
  is_template?: boolean;
  template_naam?: string | null;
  ext?: string | null;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const API_PATH = "/api/aftekenlijsten?type=all";

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

  const [openHaccp, setOpenHaccp] = useState(false);
  const [openInspectie, setOpenInspectie] = useState(false);
  const [openIncidenteel, setOpenIncidenteel] = useState(false);
  const [openTemplates, setOpenTemplates] = useState(true);

  const currentYear = useMemo(() => new Date().getFullYear(), []);

  if (isLoading || !data) {
    return (
      <main className="min-h-screen bg-slate-100 px-6 py-6">
        <div className="mx-auto max-w-7xl">
          <Header currentYear={currentYear} total={0} />
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
            <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />
            <p className="text-sm text-slate-500">Aftekenlijsten laden…</p>
          </div>
        </div>
      </main>
    );
  }

  const ingevuld = data.filter((d) => !d.is_template);
  const templates = data.filter((d) => !!d.is_template);

  const inspectierapporten = ingevuld.filter(
    (d) => d.categorie === "inspectierapporten"
  );
  const incidenteel = ingevuld.filter((d) => d.categorie === "incidenteel");
  const haccp = ingevuld.filter(
    (d) => d.categorie !== "incidenteel" && d.categorie !== "inspectierapporten"
  );

  const haccpSorted = haccp.slice().sort((a, b) => {
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

  const isAllesLeeg =
    haccp.length === 0 &&
    inspectierapporten.length === 0 &&
    incidenteel.length === 0 &&
    templates.length === 0;

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <Header currentYear={currentYear} total={data.length} />

        <div className="space-y-5">
          <Section
            title="Lege formulieren"
            subtitle={`${templates.length} template${
              templates.length === 1 ? "" : "s"
            }`}
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

          <Section
            title="HACCP-lijsten"
            subtitle={`${haccpSorted.length} ingevulde lijst${
              haccpSorted.length === 1 ? "" : "en"
            }`}
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
              />
            )}
          </Section>

          <Section
            title="Inspectierapporten"
            subtitle={`${inspectierapporten.length} rapport${
              inspectierapporten.length === 1 ? "" : "en"
            }`}
            open={openInspectie}
            onToggle={() => setOpenInspectie((v) => !v)}
          >
            {inspectierapporten.length > 0 ? (
              <TabelIngevuld
                rows={inspectierapporten}
                onDelete={handleDelete}
                deletingId={deletingId}
              />
            ) : (
              <LegeState />
            )}
          </Section>

          <Section
            title="Incidentele lijsten"
            subtitle={`${incidenteel.length} item${
              incidenteel.length === 1 ? "" : "s"
            }`}
            open={openIncidenteel}
            onToggle={() => setOpenIncidenteel((v) => !v)}
          >
            {incidenteel.length > 0 ? (
              <TabelIngevuld
                rows={incidenteel}
                onDelete={handleDelete}
                deletingId={deletingId}
              />
            ) : (
              <LegeState />
            )}
          </Section>

          {isAllesLeeg && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
              Geen registraties gevonden.
            </div>
          )}
        </div>

        <ScrollToTopButton />
      </div>
    </main>
  );
}

function Header({ currentYear, total }: { currentYear: number; total: number }) {
  return (
    <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-600">
            <FileText className="h-4 w-4" />
            HACCP / Aftekenlijsten
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Aftekenlijsten
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Beheer ingevulde lijsten, inspectierapporten en templates voor{" "}
            {currentYear}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl bg-blue-50 px-4 py-3 ring-1 ring-blue-100">
            <div className="text-xs font-medium uppercase tracking-wide text-blue-600">
              Items
            </div>
            <div className="text-2xl font-bold text-blue-950">{total}</div>
          </div>

          <Link
            href="/admin/aftekenlijsten/upload"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus size={16} />
            Nieuwe lijst uploaden
          </Link>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  open,
  onToggle,
  children,
}: {
  title: string;
  subtitle: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 border-b border-slate-200 bg-slate-50 px-5 py-4 text-left transition hover:bg-slate-100"
      >
        <div>
          <h2 className="text-lg font-bold text-slate-950">{title}</h2>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>

        <span className="text-slate-500">
          {open ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
        </span>
      </button>

      {open && <div className="p-4">{children}</div>}
    </section>
  );
}

function TabelIngevuld({
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
      <table className="w-full min-w-[820px] text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="border-b border-slate-200 px-4 py-3 text-left">
              Week
            </th>
            <th className="border-b border-slate-200 px-4 py-3 text-left">
              Jaar
            </th>
            <th className="border-b border-slate-200 px-4 py-3 text-left">
              Categorie
            </th>
            <th className="border-b border-slate-200 px-4 py-3 text-left">
              Bestand
            </th>
            <th className="border-b border-slate-200 px-4 py-3 text-left">
              Opmerking
            </th>
            <th className="border-b border-slate-200 px-4 py-3 text-right">
              Actie
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => {
            const link = getLink(r);
            const opmerking = getLabel(r);

            return (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-semibold text-slate-950">
                  {r.week ?? "—"}
                </td>

                <td className="px-4 py-3 text-slate-700">{r.jaar ?? "—"}</td>

                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                    {categorieNamen[String(r.categorie)] ?? String(r.categorie)}
                  </span>
                </td>

                <td className="px-4 py-3">
                  {link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-100 transition hover:bg-blue-100"
                    >
                      <Download size={14} />
                      Download
                    </a>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>

                <td className="px-4 py-3 text-slate-600">{opmerking || "—"}</td>

                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onDelete(r.id)}
                    disabled={deletingId === r.id}
                    className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    title="Verwijderen"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
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
      <table className="w-full min-w-[720px] text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="border-b border-slate-200 px-4 py-3 text-left">
              Categorie
            </th>
            <th className="border-b border-slate-200 px-4 py-3 text-left">
              Bestand
            </th>
            <th className="border-b border-slate-200 px-4 py-3 text-left">
              Naam / opmerking
            </th>
            <th className="border-b border-slate-200 px-4 py-3 text-right">
              Actie
            </th>
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => {
            const link = getLink(r);
            const naam = getLabel(r) || r.template_naam || "—";

            return (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                    {categorieNamen[String(r.categorie)] ?? String(r.categorie)}
                  </span>
                </td>

                <td className="px-4 py-3">
                  {link ? (
                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 ring-1 ring-blue-100 transition hover:bg-blue-100"
                    >
                      <Download size={14} />
                      Download
                    </a>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>

                <td className="px-4 py-3 font-medium text-slate-700">{naam}</td>

                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => onDelete(r.id)}
                    disabled={deletingId === r.id}
                    className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                    title="Verwijderen"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function LegeState() {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
      Geen items.
    </div>
  );
}

function getLink(r: Row) {
  const link = r.bestand_url?.trim();
  return link && link.length > 0 ? link : null;
}

function getLabel(r: Row) {
  const opm = r.opmerking?.trim();
  if (opm) return opm;

  const name = fileNameFromUrl(r.bestand_url ?? "");
  return name || "";
}

function fileNameFromUrl(value: string) {
  const url = value.trim();
  if (!url) return "";

  try {
    const u = new URL(url);
    return u.pathname.split("/").filter(Boolean).pop() ?? "";
  } catch {
    return url.split("/").filter(Boolean).pop() ?? "";
  }
}