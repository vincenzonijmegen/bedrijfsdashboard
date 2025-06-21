// app/sollicitatie/pdf/page.tsx
"use client";

import { useEffect, useState } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

function parseMail(txt: string): Record<string, string> {
  const obj: Record<string, string> = {};
  const lines = txt.split(/\r?\n/);
  lines.forEach((line) => {
    const match = line.match(/^([^:]+):\s*(.*)$/);
    if (match) {
      const [, key, val] = match;
      obj[key.trim()] = val.trim();
    }
  });
  return obj;
}

export default function SollicitatiePDF() {
  const [input, setInput] = useState("");
  const [to, setTo] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("sollicitatie_email");
    if (saved) setTo(saved);
  }, []);

  const generatePDF = () => {
    const parsed = parseMail(input);
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Sollicitatieformulier IJssalon Vincenzo", 14, 20);
    doc.setFontSize(11);

    let y = 30;
    const personal = [
      ["Voornaam", parsed["Voornaam"] || ""],
      ["Achternaam", parsed["Achternaam"] || ""],
      ["Adres", `${parsed["Adres"] || ""} ${parsed["Huisnummer"] || ""}`],
      ["Postcode/Woonplaats", `${parsed["Postcode"] || ""} ${parsed["Woonplaats"] || ""}`],
      ["Geboortedatum", parsed["Geboortedatum"] || ""],
      ["E-mailadres", parsed["E-mailadres"] || ""],
      ["Telefoonnummer", parsed["Telefoonnummer"] || ""],
      ["Startdatum", parsed["Startdatum"] || ""],
      ["Einddatum", parsed["Einddatum"] || ""],
      ["Andere bijbaan", parsed["Andere bijbaan"] || ""],
      ["Vakantie", parsed["Vakantie"] || ""]
    ];
    autoTable(doc, {
      startY: y,
      head: [["Persoonlijke gegevens", ""]],
      body: personal,
      margin: { left: 14, right: 115 },
      tableWidth: 80,
    });
    const tableEndY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y;
y = tableEndY + 10;

    const dagen = parsed["Dagen werken"]?.toLowerCase().split(",") || [];
    const dagrijen = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"].map((dag) => {
      return [
        dag,
        dagen.includes(`${dag} shift 1`) ? "JA" : "",
        dagen.includes(`${dag} shift 2`) ? "JA" : ""
      ];
    });
    dagrijen.push(["shifts per week", "", parsed["Shifts per week"] || ""]);
    dagrijen.push(["afd. voorkeur", "", parsed["Voorkeur functie"] || ""]);

    autoTable(doc, {
      startY: y,
      margin: { left: 110 },
      tableWidth: 85,
      head: [["BESCHIKBAARHEID", "SHIFT 1", "SHIFT 2"]],
      body: dagrijen,
      styles: { halign: "center" },
      headStyles: { fillColor: [0, 51, 102], textColor: 255 },
    });

    // extra velden
const extra = [
  ["Opleiding", parsed["Opleiding"] || ""],
  ["Werkervaring", parsed["Werkervaring"] || ""],
  ["Rekenvaardigheid", parsed["Rekenvaardigheid"] || ""],
  ["Kassa-ervaring", parsed["Kassa-ervaring"] || ""],
  ["Duits", parsed["Duits"] || ""],
  ["Overige zaken", parsed["Extra"] || ""]
];

const extraStartY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y;
autoTable(doc, {
  startY: extraStartY + 10,
  head: [["Extra informatie", ""]],
  body: extra,
  styles: { valign: 'top' },
  columnStyles: { 1: { cellWidth: 140 } }
});

doc.save(`sollicitatie_${parsed["Voornaam"] || "onbekend"}.pdf`);
  };

  const handleEmailSend = () => {
    const parsed = parseMail(input);
    if (!to || !parsed) return;
    localStorage.setItem("sollicitatie_email", to);
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
