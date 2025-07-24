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

// Helper: convert DD-MM-YYYY to ISO YYYY-MM-DD
const convertDDMMYYYYtoISO = (raw: string): string => {
  const [d, m, y] = raw.split('-');
  return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
};

// Helper: convert Dutch date format 'DD mmm. YYYY' (e.g., '28 aug. 2025') to ISO
const convertDutchDateToISO = (raw: string): string => {
  const parts = raw.replace('.', '').split(' ');
  if (parts.length !== 3) return raw;
  const [d, m, y] = parts;
  const monthMap: { [key: string]: string } = {
    jan: '01', feb: '02', mrt: '03', apr: '04', mei: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', okt: '10', nov: '11', dec: '12',
  };
  const monthKey = m.toLowerCase();
  const mm = monthMap[monthKey] || m;
  return `${y}-${mm}-${d.padStart(2, '0')}`;
};

export default function ShiftMailParser() {
  const router = useRouter();
  const [input, setInput] = useState("");
  const [parsed, setParsed] = useState<ParsedActie | null>(null);

  const parse = () => {
    const lines = input
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
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
      // Open dienst opgepakt
      result.type = "Open dienst opgepakt";
      result.naar =
        lines.find((l) => l.toLowerCase().includes("heeft een open dienst geaccepteerd"))
          ?.split(" heeft")[0] || "";

      // Datum: tekstuele Nederlandse datum, bv. 'donderdag 28 aug. 2025'
      const dateLine = lines.find((l) =>
        /(maandag|dinsdag|woensdag|donderdag|vrijdag|zaterdag|zondag)\s+\d{1,2}\s+[a-z]{3,}\.\s+\d{4}/i.test(l)
      );
      if (dateLine) {
        // extract 'DD mmm. YYYY'
        const match = dateLine.match(/\d{1,2}\s+[a-z]{3,}\.\s+\d{4}/i);
        if (match) {
          result.datum = convertDutchDateToISO(match[0]);
        }
      }

      // Tijd: uit vrije tekst (bv. 'Tijd: 07:30 - 16:30')
      result.tijd =
        lines
          .find((l) => l.toLowerCase().startsWith("tijd"))
          ?.match(/\d{2}:\d{2}\s*-\s*\d{2}:\d{2}/)?.[0] || "";

      // Shift: uit vrije tekst (bv. 'Dienst: Dagdienst')
      result.shift =
        lines
          .find((l) => l.toLowerCase().startsWith("dienst"))
          ?.split(/:|\t/)[1]
          ?.trim() || "";

    } else if (
      mailText.includes("heeft een ruilaanvraag") &&
      mailText.includes("geaccepteerd")
    ) {
      // Ruil geaccepteerd
      result.type = "Ruil geaccepteerd";
      result.naar =
        lines.find((l) => l.toLowerCase().includes("heeft een ruilaanvraag"))
          ?.split(" heeft")[0] || "";

      const ruilIdx = lines.findIndex((l) =>
        l.toLowerCase().includes("ruilverzoek")
      );
      if (ruilIdx >= 0) {
        const header = lines[ruilIdx + 1].split(/\t+/).map((h) =>
          h.toLowerCase()
        );
        const values = lines[ruilIdx + 2].split(/\t+/);

        const idxDatum = header.findIndex((h) => h === "datum");
        const idxShift = header.findIndex((h) => h === "dienst");
        const idxStart = header.findIndex((h) => h === "van");
        const idxEnd = header.findIndex((h) => h === "tot");

        if (idxDatum >= 0 && values[idxDatum]) {
          const raw = values[idxDatum].trim();
          if (/\d{2}-\d{2}-\d{4}/.test(raw)) {
            result.datum = convertDDMMYYYYtoISO(raw.match(/\d{2}-\d{2}-\d{4}/)![0]);
          }
        }
        if (idxShift >= 0) result.shift = values[idxShift].trim();

        const ruilLine = lines.find(l => l.toLowerCase().includes("heeft een ruilaanvraag"));
        const vanMatch = ruilLine?.match(/heeft een ruilaanvraag van\s+(.*?)\s+voor/i);
        if (vanMatch) {
          result.van = vanMatch[1].trim();
        }

        if (idxStart >= 0 && idxEnd >= 0) {
          result.tijd = `${values[idxStart].trim()} - ${values[idxEnd].trim()}`;
        }
      }
    } else {
      alert("Onbekend e-mailformaat");
      return;
    }

    console.log("[DEBUG] Geparse resultaat:", result);
    setParsed(result);
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
      <button
        onClick={() => router.push('/shift-acties')}
        className="mb-4 text-blue-600 hover:underline"
      >
        ← Terug naar shiftacties
      </button>
      <h1 className="text-xl font-bold mb-4">📬 Mailparser: Shiftactie invoer</h1>
      <textarea
        className="w-full h-60 border p-2 font-mono text-sm"
        placeholder="Plak hier de volledige e-mailtekst..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />
      <div className="flex gap-4 my-4">
        <button
          onClick={parse}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          Parser uitvoeren
        </button>
        {parsed && (
          <button
            onClick={sendToDatabase}
            className="bg-green-600 text-white px-4 py-2 rounded"
          >
            ➕ Voeg toe aan database
          </button>
        )}
      </div>
      {parsed && (
        <div className="mt-4">
          <button
            onClick={() => router.push('/')}
            className="mb-4 text-blue-600 hover:underline"
          >
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
