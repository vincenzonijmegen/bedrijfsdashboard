// src/app/admin/besteltool/bestel-import/page.tsx

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function BestelImport() {
  const [bestand, setBestand] = useState<File | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const handleUpload = async () => {
    if (!bestand) return;
    const formData = new FormData();
    formData.append("file", bestand);

    const res = await fetch("/api/bestel/import", {
      method: "POST",
      body: formData,
    });

    if (res.ok) {
      setStatus("✅ Bestand verwerkt");
    } else {
      setStatus("❌ Fout bij importeren");
    }
  };

  return (
    <main className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold">📥 Excel import – Producten & Leveranciers</h1>

      <input
        type="file"
        accept=".xlsx"
        onChange={(e) => setBestand(e.target.files?.[0] ?? null)}
      />

      <Button onClick={handleUpload} disabled={!bestand}>Verwerk bestand</Button>

      {status && <p>{status}</p>}
    </main>
  );
}
