// app/shift-acties/parse/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from 'next/navigation';

interface ParsedActie {
  datum: string;
  tijd: string;
  shift: string;
  van: string;
  naar: string;
  type: string;
  bron_email: string;
}

export default function ShiftMailParser() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [parsed, setParsed] = useState<ParsedActie | null>(null);

  const parse = () => {
    const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const mailText = input.toLowerCase();

    const result: ParsedActie = {
      datum: "",
      tijd: "",
      shift: "",
      van: "",
      naar: "",
      type: "",
      bron_email: input,
    };

    if (mailText.includes("heeft een open dienst geaccepteerd")) {
      result.type = "Open dienst opgepakt";
      result.naar = lines.find((l) => l.includes("heeft een open dienst geaccepteerd"))?.split(" heeft")[0] || "";

      // Neem expliciet de regel die begint met "Open dienst:"
      const dateLine = lines.find((l) => l.toLowerCase().startsWith("open dienst:"));
      console.log("[DEBUG] Datumregel gevonden:", dateLine);
      result.datum = parseDate(dateLine || "");

      result.tijd = lines.find((l) => l.toLowerCase().startsWith("tijd"))
        ?.match(/\d{2}:\d{2}\s*-\s*\d{2}:\d{2}/)?.[0] || "";
      result.shift = lines.find((l) => l.toLowerCase().startsWith("dienst"))
        ?.split(/:|\t/)[1]?.trim() || "";
      result.van = "";
    } else if (mailText.includes("heeft een ruilaanvraag") && mailText.includes("geaccepteerd")) {
      result.type = "Ruil geaccepteerd";
      result.naar = lines.find((l) => l.toLowerCase().includes("heeft een ruilaanvraag"))?.split(" heeft")[0] || "";
      result.van = lines.find((l) => l.toLowerCase().startsWith("van"))
        ?.split(/:|\t/)[1]?.trim() || "";
      result.tijd = (lines.find((l) => l.toLowerCase().startsWith("van"))
        ?.split(/:|\t/)[1]?.trim() || "") + " - " +
        (lines.find((l) => l.toLowerCase().startsWith("tot"))
        ?.split(/:|\t/)[1]?.trim() || "");
      result.datum = parseDate(
        lines.find((l) => l.toLowerCase().startsWith("datum"))
          ?.split(/:|\t/)[1]?.trim() || ""
      );
      result.shift = lines.find((l) => l.toLowerCase().startsWith("dienst"))
        ?.split(/:|\t/)[1]?.trim() || "";
    } else {
      alert("Onbekend e-mailformaat");
      return;
    }

    console.log("[DEBUG] Geparse resultaat:", result);
    setParsed(result);
  };

  const parseDate = (line: string) => {
    if (!line) return "";

    const maandnamen: Record<string, number> = {
      jan: 0, januari: 0,
      feb: 1, februari: 1,
      mrt: 2, maart: 2,
      apr: 3, april: 3,
      mei: 4, may: 4,
      jun: 5, juni: 5,
      jul: 6, juli: 6,
      aug: 7, augustus: 7,
      sep: 8, september: 8,
      okt: 9, october: 9, oct: 9,
      nov: 10, november: 10,
      dec: 11, december: 11,
    };

    const cleaned = line
      .toLowerCase()
      .replace(/^.*:/, "")
      .replace(/\b(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)\b/gi, "")
      .replace(/[.,]/g, "")
      .replace(/ +/g, " ")
      .trim();

    const parts = cleaned.split(" ");
    if (parts.length !== 3) return "";

    const [dayStr, maandNaam, jaarStr] = parts;
    const day = parseInt(dayStr, 10);
    const year = parseInt(jaarStr, 10);
    const maand = maandnamen[maandNaam] !== undefined
      ? maandnamen[maandNaam]
      : maandnamen[maandNaam.slice(0, 3)];

    if (maand === undefined || isNaN(day) || isNaN(year)) return "";

    // Maak datum in lokale tijd
    const d = new Date(year, maand, day);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const iso = `${yyyy}-${mm}-${dd}`;
    console.log("[DEBUG] parseDate resultaat:", iso);
    return iso;
  };

  const sendToDatabase = async () => {
    if (!parsed) return;
    const res = await fetch("/api/shift-acties", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    });
    const json = await res.json();
    alert(json.success ? "Toegevoegd!" : json.error);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <button onClick={() => router.push('/')} className="mb-4 text-blue-600 hover:underline">
        ← Terug naar startpagina
      </button>
      <h1 className="text-xl font-bold mb-4">📬 Mailparser: Shiftactie invoer</h1>
      <textarea
        className="w-full h-60 border p-2 font-mono text-sm"
        placeholder="Plak hier de volledige e-mailtekst..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />

      <div className="flex gap-4 my-4">
        <button onClick={parse} className="bg-blue-600 text-white px-4 py-2 rounded">
          Parser uitvoeren
        </button>
        {parsed && (
          <button onClick={sendToDatabase} className="bg-green-600 text-white px-4 py-2 rounded">
            ➕ Voeg toe aan database
          </button>
        )}
      </div>

      {parsed && (
        <div className="mt-4">
          <button onClick={() => router.push('/')} className="mb-4 text-blue-600 hover:underline">
            ← Terug naar startpagina
          </button>
          <pre className="bg-gray-100 p-4 text-sm rounded">
            {JSON.stringify(parsed, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
