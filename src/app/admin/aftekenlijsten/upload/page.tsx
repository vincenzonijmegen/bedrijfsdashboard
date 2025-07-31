// src/app/admin/aftekenlijsten/upload/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const categorieOpties = [
  { label: "Winkel – begin", value: "winkel-begin" },
  { label: "Winkel – eind", value: "winkel-eind" },
  { label: "Keuken – begin", value: "keuken-begin" },
  { label: "Keuken – eind", value: "keuken-eind" },
];

export default function UploadAftekenlijst() {
  const [categorie, setCategorie] = useState("");
  const [week, setWeek] = useState<number>(0);
  const [jaar, setJaar] = useState<number>(new Date().getFullYear());
  const [bestand, setBestand] = useState<File | null>(null);
  const [opmerking, setOpmerking] = useState("");
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  const handleUpload = async () => {
    if (!categorie || !week || !jaar || !bestand) {
      alert("Vul alle verplichte velden in.");
      return;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append("file", bestand);
    formData.append("path", `aftekenlijsten/${jaar}/week-${week}-${categorie}.pdf`);

    const uploadRes = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const { url } = await uploadRes.json();

    const saveRes = await fetch("/api/aftekenlijsten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categorie,
        week,
        jaar,
        bestand_url: url,
        opmerking,
      }),
    });

    if (saveRes.ok) {
      router.push("/admin/aftekenlijsten");
    } else {
      alert("Upload mislukt");
      setUploading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Aftekenlijst uploaden</h1>

      <label className="block mb-2">Categorie</label>
      <select
        value={categorie}
        onChange={(e) => setCategorie(e.target.value)}
        className="w-full border px-3 py-2 rounded mb-4"
      >
        <option value="">-- Kies categorie --</option>
        {categorieOpties.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>

      <div className="flex gap-4 mb-4">
        <div className="flex-1">
          <label className="block mb-2">Week</label>
          <input
            type="number"
            value={week}
            onChange={(e) => setWeek(Number(e.target.value))}
            min={1} max={53}
            className="w-full border px-3 py-2 rounded"
          />
        </div>
        <div className="flex-1">
          <label className="block mb-2">Jaar</label>
          <input
            type="number"
            value={jaar}
            onChange={(e) => setJaar(Number(e.target.value))}
            min={2020} max={2100}
            className="w-full border px-3 py-2 rounded"
          />
        </div>
      </div>

      <label className="block mb-2">PDF-bestand</label>
      <input
        type="file"
        accept="application/pdf"
        onChange={(e) => setBestand(e.target.files?.[0] || null)}
        className="mb-4"
      />

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
        {uploading ? "Bezig met uploaden..." : "Uploaden"}
      </button>
    </div>
  );
}
