// src/app/admin/aftekenlijsten/upload/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";

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
  const [templateNaam, setTemplateNaam] = useState(""); // optionele naam bij template
  const [uploading, setUploading] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setIsMobile(/iPhone|iPad|iPod|Android/i.test(navigator.userAgent));
    }
  }, []);

  const handleUpload = async () => {
    // Validatie
    if (!categorie) {
      alert("Kies een categorie.");
      return;
    }
    if (soort === "ingevuld") {
      if (!week || !jaar) {
        alert("Vul de week en het jaar in.");
        return;
      }
    }
    if (!bestand) {
      alert("Kies een bestand om te uploaden.");
      return;
    }

    // Extensie bepalen + accept check (client-side guard)
    const rawName = (bestand as any).name || "bestand";
    const ext = (rawName.split(".").pop() || "").toLowerCase();

    const allowedTemplateExt = ["pdf", "doc", "docx", "xls", "xlsx"];
    if (soort === "template" && !allowedTemplateExt.includes(ext)) {
      alert("Alleen PDF, DOC, DOCX, XLS of XLSX toegestaan voor lege formulieren.");
      return;
    }

    setUploading(true);

    // Pad opbouwen
    let path = "";
    if (soort === "ingevuld") {
      // bestaand gedrag behouden; ext kan image/* zijn op mobiel of pdf op desktop
      const e = ext || "pdf";
      path = `aftekenlijsten/${jaar}/week-${week}-${categorie}.${e}`;
    } else {
      // templates opslaan onder /aftekenlijsten/templates/<categorie>/
      const base =
        templateNaam.trim() ||
        rawName.replace(/\.[^.]+$/, ""); // naam zonder extensie
      const safeBase = slug(base) || "formulier";
      path = `aftekenlijsten/templates/${categorie}/${safeBase}-${Date.now()}.${ext}`;
    }

    try {
      // 1) upload naar storage
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

      // 2) opslaan in DB via bestaande endpoint
      const payload: any = {
        categorie,
        week: soort === "ingevuld" ? week : null,
        jaar: soort === "ingevuld" ? jaar : null,
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

  // Accept-strings per modus
  const acceptTemplate =
    ".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  const acceptIngevuldDesktop = "application/pdf";

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Formulier uploaden</h1>

      {/* Soort */}
      <label className="block mb-2">Soort</label>
      <select
        value={soort}
        onChange={(e) => setSoort(e.target.value as Soort)}
        className="w-full border px-3 py-2 rounded mb-4"
      >
        <option value="ingevuld">Ingevuld formulier</option>
        <option value="template">Leeg formulier (template)</option>
      </select>

      {/* Categorie */}
      <label className="block mb-2">Categorie</label>
      <select
        value={categorie}
        onChange={(e) => setCategorie(e.target.value)}
        className="w-full border px-3 py-2 rounded mb-4"
      >
        <option value="">-- Kies categorie --</option>
        {categorieOpties.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Week/Jaar alleen bij ingevuld */}
      {soort === "ingevuld" && (
        <div className="flex gap-4 mb-4">
          <div className="flex-1">
            <label className="block mb-2">Week</label>
            <input
              type="number"
              value={week || ""}
              onChange={(e) => setWeek(Number(e.target.value))}
              min={1}
              max={53}
              className="w-full border px-3 py-2 rounded"
            />
          </div>
          <div className="flex-1">
            <label className="block mb-2">Jaar</label>
            <input
              type="number"
              value={jaar}
              onChange={(e) => setJaar(Number(e.target.value))}
              min={2020}
              max={2100}
              className="w-full border px-3 py-2 rounded"
            />
          </div>
        </div>
      )}

      {/* Uploadopties */}
      <label className="block mb-2">Bestand</label>
      <div className="flex flex-col gap-4 mb-4">
        {soort === "ingevuld" ? (
          isMobile ? (
            <label className="flex items-center justify-center gap-2 border px-3 py-2 rounded bg-gray-50 cursor-pointer">
              <Camera className="w-5 h-5 text-gray-600" />
              <span className="text-gray-700">Foto maken</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => setBestand(e.target.files?.[0] || null)}
                className="hidden"
              />
            </label>
          ) : (
            <label className="flex flex-col gap-1 border px-3 py-2 rounded bg-gray-50">
              PDF uploaden:
              <input
                type="file"
                accept={acceptIngevuldDesktop}
                onChange={(e) => setBestand(e.target.files?.[0] || null)}
                className="block"
              />
            </label>
          )
        ) : (
          // soort === "template"
          <>
            <label className="flex flex-col gap-1 border px-3 py-2 rounded bg-gray-50">
              Leeg formulier uploaden (PDF/DOC/DOCX/XLS/XLSX):
              <input
                type="file"
                accept={acceptTemplate}
                onChange={(e) => setBestand(e.target.files?.[0] || null)}
                className="block"
              />
            </label>
            <div>
              <label className="block mb-1 text-sm text-gray-700">
                Bestandsnaam (optioneel, zonder extensie)
              </label>
              <input
                type="text"
                value={templateNaam}
                onChange={(e) => setTemplateNaam(e.target.value)}
                placeholder="bv. daglijst-keuken"
                className="w-full border px-3 py-2 rounded"
              />
              <p className="text-xs text-gray-500 mt-1">
                Laat leeg om de bestandsnaam van het geüploade bestand te gebruiken.
              </p>
            </div>
          </>
        )}
      </div>

      <label className="block mb-2">Opmerking (optioneel)</label>
      <textarea
        value={opmerking}
        onChange={(e) => setOpmerking(e.target.value)}
        className="w-full border px-3 py-2 rounded mb-4"
      />

      <button
        disabled={uploading}
        onClick={handleUpload}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {uploading
          ? "Bezig met uploaden..."
          : soort === "template"
          ? "Leeg formulier uploaden"
          : "Ingevuld formulier uploaden"}
      </button>
    </div>
  );
}
