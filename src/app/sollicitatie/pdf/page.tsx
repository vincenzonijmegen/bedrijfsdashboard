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

  const generatePDF = async () => {
    const parsed = parseMail(input);
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Sollicitatieformulier IJssalon Vincenzo - Datum gesprek:", 14, 20);
    doc.setFontSize(11);

    const y = 30;
    const personal = [
      ["\u0000Voornaam", parsed["Voornaam"] || ""],
      ["\u0000Achternaam", parsed["Achternaam"] || ""],
      ["\u0000Adres", `${parsed["Adres"] || ""} ${parsed["Huisnummer"] || ""}`],
      ["\u0000PC/Woonplaats", `${parsed["Postcode"] || ""} ${parsed["Woonplaats"] || ""}`],
      ["\u0000Geboortedatum", parsed["Geboortedatum"] || ""],
      ["\u0000E-mailadres", parsed["E-mailadres"] || ""],
      ["\u0000Telefoonnummer", parsed["Telefoonnummer"] || ""],
      ["\u0000Startdatum", parsed["Startdatum"] || ""],
      ["\u0000Einddatum", parsed["Einddatum"] || ""],
      ["\u0000Andere bijbaan", parsed["Andere bijbaan"] || ""],
      ["\u0000Extra", parsed["Extra"] || ""]
    ];
    autoTable(doc, {
      startY: y,
      head: [["Gegevens", ""]],
      margin: { left: 14 },
      tableWidth: 90,
      body: personal,
      styles: { cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: 'bold' }
      },
      headStyles: { cellPadding: 2, fontStyle: 'bold', halign: 'left', minCellHeight: 8 },
    });

    const dagen = parsed["Dagen werken"]?.toLowerCase().split(",") || [];
    const dagrijen = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"].map((dag) => {
      return [
        dag,
        dagen.includes(`${dag} shift 1`) ? "JA" : "",
        dagen.includes(`${dag} shift 2`) ? "JA" : ""
      ];
    });
    const availabilityStartY = y;
    dagrijen.push(["shifts per week", "", parsed["Shifts per week"] || ""]);
    dagrijen.push(["afd. voorkeur", "", parsed["Voorkeur functie"] || ""]);

    autoTable(doc, {
      startY: availabilityStartY,
      margin: { left: 115 },
      tableWidth: 85,
      head: [["BESCHIKBAAR", "SHIFT 1", "SHIFT 2"]],
      theme: 'grid',
      body: dagrijen,
      styles: { halign: "center" },
      headStyles: { fillColor: [0, 51, 102], textColor: 255 },
      didParseCell(data) {
        if (data.column.index === 0) {
          data.cell.styles.fontStyle = 'bold';
        }
        if (data.cell.raw === "JA") {
          data.cell.styles.fillColor = [200, 255, 200];
        }
      }
    });

    const extra = [
      ["\u0000Opleiding", parsed["Opleiding"] || ""],
      ["\u0000Werkervaring", parsed["Werkervaring"] || ""],
      ["\u0000Rekenvaardigheid", parsed["Rekenvaardigheid"] || ""],
      ["\u0000Kassa-ervaring", parsed["Kassa-ervaring"] || ""],
      ["\u0000Duits", parsed["Duits"] || ""],
      ["\u0000Vakantie", parsed["Vakantie"] || ""],
      ["\u0000Extra", parsed["Extra"] || ""],
      ["\u0000Overige zaken", parsed["Overige zaken"] || ""]
    ];

    const extraStartY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y;
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold");
    doc.text("Overige gegevens", 14, extraStartY + 12);

    autoTable(doc, {
      startY: extraStartY + 16,
      body: extra,
      styles: {
        valign: 'top',
        cellPadding: 2,
        overflow: 'linebreak'
      },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { cellWidth: 'wrap' }
      },
      didParseCell(data) {
        if ([0, 1].includes(data.row.index)) {
          data.cell.styles.minCellHeight = 20;
        }
      }
    });

    doc.save(`sollicitatie_${parsed["Voornaam"] || "onbekend"}.pdf`);
  };

  const handleEmailSend = async () => {
    const parsed = parseMail(input);
    if (!to || !parsed) return;
    localStorage.setItem("sollicitatie_email", to);
    try {
      const parsed = parseMail(input);
      const dagen = parsed["Dagen werken"]?.toLowerCase().split(",") || [];

      const payload = {
        dagen,
        voornaam: parsed["Voornaam"],
        achternaam: parsed["Achternaam"],
        geboortedatum: parsed["Geboortedatum"],
        email: parsed["E-mailadres"],
        telefoon: parsed["Telefoonnummer"],
        adres: `${parsed["Adres"] || ""} ${parsed["Huisnummer"] || ""}`.trim(),
        postcode: parsed["Postcode"],
        woonplaats: parsed["Woonplaats"],
        startdatum: parsed["Startdatum"],
        einddatum: parsed["Einddatum"],
        bijbaan: parsed["Andere bijbaan"],
        vakantie: parsed["Vakantie"],
        shifts_per_week: Number(parsed["Shifts per week"] || 0),
        voorkeur: parsed["Voorkeur functie"],
        opleiding: parsed["Opleiding"],
        ervaring: parsed["Werkervaring"],
        rekenen: parsed["Rekenvaardigheid"],
        kassa: parsed["Kassa-ervaring"],
        duits: parsed["Duits"],
        extra: parsed["Extra"],
        overige_zaken: parsed["Overige zaken"],
        ...Object.fromEntries(
          ["ma","di","wo","do","vr","za","zo"].flatMap((dag) => [
            [`beschikbaar_${dag}_1`, dagen.includes(`${dag} shift 1`)],
            [`beschikbaar_${dag}_2`, dagen.includes(`${dag} shift 2`)],
          ])
        )
      };

      const res = await fetch("/api/sollicitaties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const json = await res.json();
      if (json.success) {
        alert(`PDF-data opgeslagen in database. Naar ${to}`);
      } else {
        alert("Fout bij opslaan: " + json.error);
      }
    } catch (err) {
      console.error(err);
      alert("Verwerken mislukt");
    }
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
