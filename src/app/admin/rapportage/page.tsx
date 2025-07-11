// Bestand: src/app/admin/rapportage/omzet/page.tsx
"use client";

import { useState } from "react";

export default function UploadOmzetPagina() {
  const [bestand, setBestand] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const uploaden = async () => {
    if (!bestand) return;
    setStatus("Uploaden...");

    const formData = new FormData();
    formData.append("file", bestand);

    const res = await fetch("/api/rapportage/omzet/upload", {
      method: "POST",
      body: formData,
    });

    const json = await res.json();
    if (res.ok) {
      setStatus(`✅ ${json.ingevoerd} regels geïmporteerd.`);
    } else {
      setStatus(`❌ Fout: ${json.error}`);
    }
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Omzetbestand uploaden</h1>

      <input
        type="file"
        accept=".csv"
        onChange={(e) => setBestand(e.target.files?.[0] || null)}
        className="mb-4"
      />

      <button
        onClick={uploaden}
        disabled={!bestand}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        Upload CSV
      </button>

      {status && <p className="mt-4 font-mono text-sm">{status}</p>}
    </div>
  );
}
