"use client";

import useSWR from "swr";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";

type Categorie =
  | "winkel-begin"
  | "winkel-eind"
  | "keuken-begin"
  | "keuken-eind"
  | "inspectierapporten"
  | "incidenteel";

type Row = {
  id: number;
  categorie: Categorie;
  week: number;
  jaar: number;
  opmerking?: string | null;
  bestand_url?: string | null;
};

const fetcher = (url: string) => fetch(url).then((r) => r.json());

// Backend-pad
const API_PATH = "/api/aftekenlijsten";

const categorieNamen: Record<string, string> = {
  "winkel-begin": "Winkel – begin",
  "winkel-eind": "Winkel – eind",
  "keuken-begin": "Keuken – begin",
  "keuken-eind": "Keuken – eind",
  "inspectierapporten": "Inspectierapporten",
  "incidenteel": "Incidenteel",
};

const HACCP_CAT_ORDER: Categorie[] = [
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

  // Upload-modal
  const [showUpload, setShowUpload] = useState(false);

  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const weeks = useMemo(() => Array.from({ length: 53 }, (_, i) => i + 1), []);

  if (isLoading || !data) {
    return (
      <main className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-semibold">Aftekenlijsten</h1>
          <button
            onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded shadow hover:bg-blue-700"
          >
            <Plus size={18} /> Nieuwe lijst uploaden
          </button>
        </div>
        Laden…
      </main>
    );
  }

  // Split naar secties
  const inspectierapporten = data.filter((d) => d.categorie === "inspectierapporten");
  const incidenteel = data.filter((d) => d.categorie === "incidenteel");
  const haccp = data.filter(
    (d) => d.categorie !== "incidenteel" && d.categorie !== "inspectierapporten"
  );

  // HACCP sortering: datum nieuw→oud, daarna categorievolgorde, daarna id nieuw→oud
  const haccpSorted = haccp
    .slice()
    .sort((a, b) => {
      if (b.jaar !== a.jaar) return b.jaar - a.jaar;
      if (b.week !== a.week) return b.week - a.week;
      const pa = HACCP_CAT_ORDER.indexOf(a.categorie);
      const pb = HACCP_CAT_ORDER.indexOf(b.categorie);
      if (pa !== pb) return pa - pb;
      return b.id - a.id;
    });

  async function handleDelete(id: number) {
    if (!confirm("Weet je zeker dat je dit item wilt verwijderen?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(API_PATH, {
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
      {/* kop + uploadknop */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Aftekenlijsten</h1>
        <button
          onClick={() => setShowUpload(true)}
          className="inline-flex items-center gap-2 bg-blue-600 text-white px-3 py-2 rounded shadow hover:bg-blue-700"
        >
          <Plus size={18} /> Nieuwe lijst uploaden
        </button>
      </div>

      {/* HACCP */}
      <Section
        title="HACCP-lijsten"
        open={openHaccp}
        onToggle={() => setOpenHaccp((v) => !v)}
      >
        {haccpSorted.length === 0 ? (
          <LegeState />
        ) : (
          <Tabel
            rows={haccpSorted}
            onDelete={handleDelete}
            deletingId={deletingId}
            showBestandKolom
          />
        )}
      </Section>

      {/* Inspectierapporten */}
      <Section
        title="Inspectierapporten"
        open={openInspectie}
        onToggle={() => setOpenInspectie((v) => !v)}
      >
        {inspectierapporten.length > 0 ? (
          <Tabel
            rows={inspectierapporten}
            onDelete={handleDelete}
            deletingId={deletingId}
            showBestandKolom
          />
        ) : (
          <LegeState />
        )}
      </Section>

      {/* Incidenteel */}
      <Section
        title="Incidentele lijsten"
        open={openIncidenteel}
        onToggle={() => setOpenIncidenteel((v) => !v)}
      >
        {incidenteel.length > 0 ? (
          <Tabel
            rows={incidenteel}
            onDelete={handleDelete}
            deletingId={deletingId}
            showBestandKolom
          />
        ) : (
          <LegeState />
        )}
      </Section>

      {/* Upload modal */}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onSaved={async () => {
            setShowUpload(false);
            await mutate();
          }}
          defaultJaar={currentYear}
          weeks={weeks}
        />
      )}
    </main>
  );
}

/* -------------------- Upload Modal -------------------- */

function UploadModal({
  onClose,
  onSaved,
  defaultJaar,
  weeks,
}: {
  onClose: () => void;
  onSaved: () => void;
  defaultJaar: number;
  weeks: number[];
}) {
  const [categorie, setCategorie] = useState<Categorie>("keuken-begin");
  const [jaar, setJaar] = useState<number>(defaultJaar);
  const [week, setWeek] = useState<number>(weeks.find((w) => w === getISOWeek(new Date())) || 1);
  const [bestandUrl, setBestandUrl] = useState<string>("");
  const [opmerking, setOpmerking] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      if (!bestandUrl.trim()) {
        setError("Voer de bestand-URL in.");
        setBusy(false);
        return;
      }
      const res = await fetch(API_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categorie,
          jaar,
          week,
          bestand_url: bestandUrl.trim(),
          opmerking: opmerking.trim() || null,
        }),
      });
      if (!res.ok) {
        const t = await res.text();
        setError(`Opslaan mislukt: ${t}`);
      } else {
        onSaved();
      }
    } catch (e: any) {
      setError(`Opslaan mislukt: ${e?.message ?? "onbekende fout"}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white w-full max-w-xl rounded-lg shadow-lg p-5">
        <h2 className="text-lg font-semibold mb-4">Nieuwe lijst uploaden</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Categorie</label>
            <select
              className="w-full border rounded px-2 py-1"
              value={categorie}
              onChange={(e) => setCategorie(e.target.value as Categorie)}
            >
              <option value="keuken-begin">Keuken – begin</option>
              <option value="keuken-eind">Keuken – eind</option>
              <option value="winkel-begin">Winkel – begin</option>
              <option value="winkel-eind">Winkel – eind</option>
              <option value="inspectierapporten">Inspectierapporten</option>
              <option value="incidenteel">Incidenteel</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Jaar</label>
            <input
              type="number"
              className="w-full border rounded px-2 py-1"
              value={jaar}
              onChange={(e) => setJaar(parseInt(e.target.value || "0", 10))}
            />
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">Week</label>
            <select
              className="w-full border rounded px-2 py-1"
              value={week}
              onChange={(e) => setWeek(parseInt(e.target.value || "1", 10))}
            >
              {weeks.map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">Bestand-URL</label>
            <input
              type="url"
              placeholder="https://…"
              className="w-full border rounded px-2 py-1"
              value={bestandUrl}
              onChange={(e) => setBestandUrl(e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm text-gray-600 mb-1">Opmerking (optioneel)</label>
            <input
              type="text"
              className="w-full border rounded px-2 py-1"
              value={opmerking}
              onChange={(e) => setOpmerking(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1 rounded border hover:bg-gray-50"
            disabled={busy}
          >
            Annuleren
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            disabled={busy}
          >
            {busy ? "Opslaan…" : "Opslaan"}
          </button>
        </div>
      </div>
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

function Tabel({
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
            const link = r.bestand_url && r.bestand_url.trim().length > 0 ? r.bestand_url : null;
            return (
              <tr key={r.id} className="bg-white">
                <td className="border px-3 py-2">
                  {r.week}
                  <span className="ml-2 text-gray-400">• {categorieNamen[r.categorie] ?? r.categorie}</span>
                </td>
                <td className="border px-3 py-2">{r.jaar}</td>
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
              <td className="border px-3 py-4 text-gray-500" colSpan={showBestandKolom ? 5 : 4}>
                Geen items.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function LegeState() {
  return <div className="text-gray-500 px-1 py-2">Geen items.</div>;
}

/* -------------------- helpers -------------------- */

function getISOWeek(d: Date) {
  // ISO weeknummering
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  // donderdag in huidige week
  const dayNum = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNum + 3);
  // eerste donderdag van het jaar
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const firstThursdayDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDayNum + 3);
  // weeknummer
  const weekNo = 1 + Math.round((date.getTime() - firstThursday.getTime()) / 604800000);
  return weekNo;
}
