// src/app/admin/beschikbaarheid/nieuw/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const dagen = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];

export default function NieuwBeschikbaarheidFormulier() {
  const [startdatum, setStartdatum] = useState("");
  const [einddatum, setEinddatum] = useState("");
  const [maxShifts, setMaxShifts] = useState(2);
  const [shifts, setShifts] = useState<Record<string, { s1: boolean; s2: boolean }>>({
    maandag: { s1: false, s2: false },
    dinsdag: { s1: false, s2: false },
    woensdag: { s1: false, s2: false },
    donderdag: { s1: false, s2: false },
    vrijdag: { s1: false, s2: false },
    zaterdag: { s1: false, s2: false },
    zondag: { s1: false, s2: false },
  });
  const [opmerking, setOpmerking] = useState("");
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  const toggle = (dag: string, shift: "s1" | "s2") => {
    setShifts((prev) => ({
      ...prev,
      [dag]: { ...prev[dag], [shift]: !prev[dag][shift] },
    }));
  };

  const handleSubmit = async () => {
    if (!startdatum || !einddatum) {
      alert("Start- en einddatum zijn verplicht");
      return;
    }
    setUploading(true);

    const res = await fetch("/api/beschikbaarheid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        startdatum,
        einddatum,
        max_shifts_per_week: maxShifts,
        opmerkingen: opmerking,
        bron: "beheer",
        ...Object.fromEntries(
          dagen.flatMap((dag) => [
            [`${dag}_1`, shifts[dag].s1],
            [`${dag}_2`, shifts[dag].s2],
          ])
        ),
      }),
    });

    if (res.ok) {
      router.push("/admin/beschikbaarheid");
    } else {
      alert("Opslaan mislukt");
      setUploading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Nieuwe beschikbaarheid invoeren</h1>

      <div className="mb-4">
        <label className="block mb-1">Startdatum</label>
        <input type="date" value={startdatum} onChange={(e) => setStartdatum(e.target.value)} className="border px-3 py-2 rounded w-full" />
      </div>
      <div className="mb-4">
        <label className="block mb-1">Einddatum</label>
        <input type="date" value={einddatum} onChange={(e) => setEinddatum(e.target.value)} className="border px-3 py-2 rounded w-full" />
      </div>
      <div className="mb-4">
        <label className="block mb-1">Maximaal aantal shifts per week</label>
        <input type="number" value={maxShifts} onChange={(e) => setMaxShifts(Number(e.target.value))} className="border px-3 py-2 rounded w-full" min={1} max={14} />
      </div>

      <div className="mb-4">
        <label className="block mb-1">Beschikbaarheid per dag</label>
        <table className="w-full border text-sm">
          <thead>
            <tr>
              <th className="border px-2 py-1 text-left">Dag</th>
              <th className="border px-2 py-1">Shift 1</th>
              <th className="border px-2 py-1">Shift 2</th>
            </tr>
          </thead>
          <tbody>
            {dagen.map((dag) => (
              <tr key={dag}>
                <td className="border px-2 py-1 font-medium">{dag.charAt(0).toUpperCase() + dag.slice(1)}</td>
                <td className="border px-2 py-1 text-center">
                  <input type="checkbox" checked={shifts[dag].s1} onChange={() => toggle(dag, "s1")} />
                </td>
                <td className="border px-2 py-1 text-center">
                  <input type="checkbox" checked={shifts[dag].s2} onChange={() => toggle(dag, "s2")} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-4">
        <label className="block mb-1">Opmerking (optioneel)</label>
        <textarea value={opmerking} onChange={(e) => setOpmerking(e.target.value)} className="border px-3 py-2 rounded w-full" />
      </div>

      <button
        disabled={uploading}
        onClick={handleSubmit}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {uploading ? "Bezig met opslaan..." : "Opslaan"}
      </button>
    </div>
  );
}
