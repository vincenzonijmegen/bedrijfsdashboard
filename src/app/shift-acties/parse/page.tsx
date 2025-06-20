// app/shift-acties/parse/page.tsx
"use client";

import { useState } from "react";

export default function ShiftMailParser() {
  const [input, setInput] = useState("");
  const [parsed, setParsed] = useState<any | null>(null);

  const parse = () => {
    const lines = input.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

    const mailText = input.toLowerCase();
    const result: any = {
      bron_email: input,
    };

    if (mailText.includes("heeft een open dienst geaccepteerd")) {
      // Open dienst opgepakt
      result.type = "Open dienst opgepakt";
      result.naar = lines.find((l) => l.includes("heeft een open dienst geaccepteerd"))?.split(" heeft")[0] || "";
      result.datum = parseDate(lines.find((l) => l.toLowerCase().startsWith("open dienst:")));
      result.tijd = getValueAfter(lines, "tijd");
      result.shift = getValueAfter(lines, "dienst");
      result.van = "";
    } else if (mailText.includes("heeft een ruilaanvraag") && mailText.includes("geaccepteerd")) {
      // Dienst geruild
      result.type = "Ruil geaccepteerd";
      result.naar = lines.find((l) => l.toLowerCase().includes("heeft een ruilaanvraag"))?.split(" heeft")[0] || "";
      result.van = getValueAfter(lines, "van");
      result.tijd = getValueAfter(lines, "van") + " - " + getValueAfter(lines, "tot");
      result.datum = parseDate(getValueAfter(lines, "datum"));
      result.shift = getValueAfter(lines, "dienst");
    } else {
      alert("Onbekend e-mailformaat");
      return;
    }

    setParsed(result);
  };

  const parseDate = (line?: string) => {
    if (!line) return "";
    const cleaned = line.replace(/[a-zA-Z]+\.?/g, (match) => match.slice(0, 3)).replace("mei", "May").replace("mrt", "Mar");
    const parts = cleaned.match(/(\d{2}-\d{2}-\d{4}|\d{1,2} \w{3}\. \d{4})/);
    if (!parts) return "";
    return new Date(parts[0]).toISOString().split("T")[0];
  };

  const getValueAfter = (lines: string[], key: string) => {
    const found = lines.find((l) => l.toLowerCase().startsWith(key.toLowerCase()));
    return found?.split(/:|\t/)[1]?.trim() || "";
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
        <pre className="bg-gray-100 p-4 text-sm rounded">
          {JSON.stringify(parsed, null, 2)}
        </pre>
      )}
    </div>
  );
}
