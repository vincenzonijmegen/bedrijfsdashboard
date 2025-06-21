// app/sollicitatie/pdf/page.tsx
"use client";

import { useEffect, useState } from "react";
import jsPDF from "jspdf";

export default function SollicitatiePDF() {
  const [input, setInput] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("sollicitatie_email");
    if (saved) setTo(saved);
  }, []);

  const parsed = parseMail(input);

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Sollicitatieformulier IJssalon Vincenzo", 14, 20);
    doc.setFontSize(11);

    const rows = Object.entries(parsed);
    let y = 30;
    rows.forEach(([key, value]) => {
      doc.text(`${key}: ${value}`, 14, y);
      y += 8;
    });

    doc.save(`sollicitatie_${parsed["Voornaam"] || "onbekend"}.pdf`);
  };

  const parseMail = (txt: string) => {
    const obj: Record<string, string> = {};
    const lines = txt.split(/\r?\n/);
    lines.forEach((line) => {
      const match = line.match(/^([^:]+):\s*(.*)$/);
      if (match) {
        const [_, key, val] = match;
        obj[key.trim()] = val.trim();
      }
    });
    return obj;
  };

  const handleEmailSend = () => {
    if (!to || !parsed) return;
    localStorage.setItem("sollicitatie_email", to);
    // hier zou normaal een backend/emailservice aangeroepen worden
    alert(`(Demo) PDF verstuurd naar ${to}`);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h1 className="text-xl font-bold mb-4">📄 Sollicitatie naar PDF</h1>
      <textarea
        className="w-full h-60 border p-2 mb-4 text-sm font-mono"
        placeholder="Plak hier de sollicitatiemail..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />

      <div className="mb-4">
        <label className="block mb-1 text-sm">Verstuur PDF naar e-mailadres:</label>
        <input
          type="email"
          className="w-full border p-2 text-sm"
          value={to}
          onChange={(e) => setTo(e.target.value)}
        />
      </div>

      <div className="flex gap-4">
        <button
          onClick={generatePDF}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          📥 Download PDF
        </button>
        <button
          onClick={handleEmailSend}
          className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
        >
          📧 Verstuur PDF
        </button>
      </div>
    </div>
  );
}
