"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  FileUp,
  Loader2,
  UploadCloud,
} from "lucide-react";

const categorieOpties = [
  { label: "Winkel – begin", value: "winkel-begin" },
  { label: "Winkel – eind", value: "winkel-eind" },
  { label: "Keuken – begin", value: "keuken-begin" },
  { label: "Keuken – eind", value: "keuken-eind" },
  { label: "Inspectierapporten", value: "inspectierapporten" },
  { label: "Incidenteel", value: "incidenteel" },
];

type Soort = "ingevuld" | "template";

function slug(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export default function UploadAftekenlijst() {
  const router = useRouter();

  const [soort, setSoort] = useState<Soort>("ingevuld");
  const [categorie, setCategorie] = useState("");
  const [week, setWeek] = useState<number | "">("");
  const [jaar, setJaar] = useState<number>(new Date().getFullYear());
  const [bestand, setBestand] = useState<File | null>(null);
  const [opmerking, setOpmerking] = useState("");
  const [templateNaam, setTemplateNaam] = useState("");
  const [uploading, setUploading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
  }, []);

  const handleUpload = async () => {
    if (!categorie) return alert("Kies een categorie.");
    if (soort === "ingevuld" && (!week || !jaar)) {
      return alert("Vul de week en het jaar in.");
    }
    if (!bestand) return alert("Kies een bestand om te uploaden.");

    const rawName = bestand.name || "bestand";
    const ext = (rawName.split(".").pop() || "").toLowerCase();
    const allowedTemplateExt = ["pdf", "doc", "docx", "xls", "xlsx"];

    if (soort === "template" && !allowedTemplateExt.includes(ext)) {
      return alert("Alleen PDF, DOC, DOCX, XLS of XLSX toegestaan.");
    }

    setUploading(true);

    try {
      let path = "";

      if (soort === "ingevuld") {
        const e = ext || "pdf";
        path = `aftekenlijsten/${jaar}/week-${week}-${categorie}.${e}`;
      } else {
        const base = templateNaam.trim() || rawName.replace(/\.[^.]+$/, "");
        const safeBase = slug(base) || "formulier";
        path = `aftekenlijsten/templates/${categorie}/${safeBase}-${Date.now()}.${ext}`;
      }

      const fd = new FormData();
      fd.append("file", bestand);
      fd.append("path", path);

      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: fd,
      });

      if (!uploadRes.ok) {
        const t = await uploadRes.text();
        throw new Error(t || "Upload mislukt");
      }

      const { url } = await uploadRes.json();

      const payload: any = {
        categorie,
        week: soort === "template" ? 0 : week,
        jaar,
        bestand_url: url,
        opmerking,
      };

      if (soort === "template") {
        payload.is_template = true;
        payload.template_naam = templateNaam.trim() || rawName;
        payload.ext = ext;
      }

      const saveRes = await fetch("/api/aftekenlijsten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!saveRes.ok) {
        const t = await saveRes.text();
        throw new Error(t || "Opslaan mislukt");
      }

      router.push("/admin/aftekenlijsten");
    } catch (err: any) {
      alert(err?.message || "Er ging iets mis bij uploaden.");
    } finally {
      setUploading(false);
    }
  };

  const acceptTemplate =
    ".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-600">
            <UploadCloud className="h-4 w-4" />
            HACCP / Aftekenlijsten
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Formulier uploaden
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Upload ingevulde formulieren of lege templates voor aftekenlijsten.
          </p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="space-y-4">
            <label>
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Soort
              </span>
              <select
                value={soort}
                onChange={(e) => setSoort(e.target.value as Soort)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                <option value="ingevuld">Ingevuld formulier</option>
                <option value="template">Leeg formulier (template)</option>
              </select>
            </label>

            <label>
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Categorie
              </span>
              <select
                value={categorie}
                onChange={(e) => setCategorie(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">-- Kies categorie --</option>
                {categorieOpties.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>

            {soort === "ingevuld" && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label>
                  <span className="mb-1 block text-sm font-semibold text-slate-700">
                    Week
                  </span>
                  <input
                    type="number"
                    value={week || ""}
                    onChange={(e) => setWeek(Number(e.target.value))}
                    min={1}
                    max={53}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label>
                  <span className="mb-1 block text-sm font-semibold text-slate-700">
                    Jaar
                  </span>
                  <input
                    type="number"
                    value={jaar}
                    onChange={(e) => setJaar(Number(e.target.value))}
                    min={2020}
                    max={2100}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
              </div>
            )}

            <div>
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Bestand
              </span>

              {soort === "ingevuld" && isMobile ? (
                <label className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-center transition hover:bg-slate-100">
                  <Camera className="h-6 w-6 text-blue-600" />
                  <span className="text-sm font-semibold text-slate-700">
                    Foto maken
                  </span>
                  <span className="text-xs text-slate-500">
                    Gebruik de camera van je telefoon.
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={(e) => setBestand(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              ) : (
                <label className="block rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 transition hover:bg-slate-100">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <FileUp className="h-5 w-5 text-blue-600" />
                    {soort === "template"
                      ? "Leeg formulier uploaden"
                      : "PDF uploaden"}
                  </div>

                  <input
                    type="file"
                    accept={soort === "template" ? acceptTemplate : "application/pdf"}
                    onChange={(e) => setBestand(e.target.files?.[0] || null)}
                    className="block w-full text-sm file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-blue-700 hover:file:bg-blue-100"
                  />
                </label>
              )}

              {bestand && (
                <div className="mt-2 rounded-xl bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 ring-1 ring-emerald-100">
                  Geselecteerd: {bestand.name}
                </div>
              )}
            </div>

            {soort === "template" && (
              <label>
                <span className="mb-1 block text-sm font-semibold text-slate-700">
                  Bestandsnaam template
                </span>
                <input
                  type="text"
                  value={templateNaam}
                  onChange={(e) => setTemplateNaam(e.target.value)}
                  placeholder="bv. daglijst-keuken"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                />
                <p className="mt-1 text-xs text-slate-500">
                  Laat leeg om de oorspronkelijke bestandsnaam te gebruiken.
                </p>
              </label>
            )}

            <label>
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Opmerking
              </span>
              <textarea
                value={opmerking}
                onChange={(e) => setOpmerking(e.target.value)}
                rows={3}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <button
              disabled={uploading}
              onClick={handleUpload}
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 sm:w-auto"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploaden...
                </>
              ) : (
                <>
                  <UploadCloud className="h-4 w-4" />
                  {soort === "template"
                    ? "Leeg formulier uploaden"
                    : "Ingevuld formulier uploaden"}
                </>
              )}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}