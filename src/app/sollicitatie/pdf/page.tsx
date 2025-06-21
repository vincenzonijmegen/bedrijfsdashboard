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
      ["\u0000Postcode/Woonplaats", `${parsed["Postcode"] || ""} ${parsed["Woonplaats"] || ""}`],
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
      }
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
      ["\u0000Overige zaken", parsed["Overige zaken"] || ""]
    ];

    const extraStartY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y;
    autoTable(doc, {
      startY: extraStartY + 10,
      head: [["Extra informatie", ""]],
      body: extra,
      styles: { valign: 'top', cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { cellWidth: 140 }
      },
      didParseCell(data) {
        if ([0, 1].includes(data.row.index)) {
          data.cell.styles.minCellHeight = 20;
        }
      }
    });

    doc.save(`sollicitatie_${parsed["Voornaam"] || "onbekend"}.pdf`);
  };

  // ... rest van de code ongewijzigd
}
