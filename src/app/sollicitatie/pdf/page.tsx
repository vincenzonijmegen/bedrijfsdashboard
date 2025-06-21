// app/sollicitatie/pdf/page.tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import jsPDF from "jspdf";


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
      ["Voornaam", parsed["Voornaam"] || ""],
      ["Achternaam", parsed["Achternaam"] || ""],
      ["Adres", `${parsed["Adres"] || ""} ${parsed["Huisnummer"] || ""}`],
      ["PC/Woonplaats", `${parsed["Postcode"] || ""} ${parsed["Woonplaats"] || ""}`],
      ["Geboortedatum", parsed["Geboortedatum"] || ""],
      ["E-mailadres", parsed["E-mailadres"] || ""],
      ["Telefoonnummer", parsed["Telefoonnummer"] || ""],
      ["Startdatum", parsed["Startdatum"] || ""],
      ["Einddatum", parsed["Einddatum"] || ""],
      ["Andere bijbaan", parsed["Andere bijbaan"] || ""],
      ["Extra", parsed["Extra"] || ""]
    ];
    doc.autoTable({
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
    // ✅ beschikbaarheidstabel
    const dagrijen = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"].map((dag) => {
      return [
        dag,
        dagen.includes(`${dag} shift 1`) ? "JA" : "",
        dagen.includes(`${dag} shift 2`) ? "JA" : ""
      ];
    });
    dagrijen.push(["shifts per week", "", parsed["Shifts per week"] || ""]);
    dagrijen.push(["afd. voorkeur", "", parsed["Voorkeur functie"] || ""]);

    doc.autoTable({
      startY: doc.lastAutoTable?.finalY || y,
      margin: { left: 115 },
      tableWidth: 85,
      head: [["BESCHIKBAAR", "SHIFT 1", "SHIFT 2"]],
      theme: 'grid',
      body: dagrijen,
      styles: { halign: "center" },
      headStyles: { fillColor: [0, 51, 102], textColor: 255 },
      didParseCell(data) {
        if (data.column.index === 0) data.cell.styles.fontStyle = 'bold';
        if (data.cell.raw === "JA") data.cell.styles.fillColor = [200, 255, 200];
      }
    });

    // ✅ overige gegevens
    const extra = [
      ["Opleiding", parsed["Opleiding"] || ""],
      ["Werkervaring", parsed["Werkervaring"] || ""],
      ["Rekenvaardigheid", parsed["Rekenvaardigheid"] || ""],
      ["Kassa-ervaring", parsed["Kassa-ervaring"] || ""],
      ["Duits", parsed["Duits"] || ""],
      ["Vakantie", parsed["Vakantie"] || ""],
      ["Extra", parsed["Extra"] || ""],
      ["Overige zaken", parsed["Overige zaken"] || ""]
    ];

    doc.autoTable({
      startY: doc.lastAutoTable?.finalY + 10 || y,
      body: extra,
      styles: { valign: 'top', cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { cellWidth: 140 }
      }
    });

    // ✅ feestdagen
    const jaar = new Date().getFullYear();

    function getPasen(y) {
      const f = Math.floor,
        G = y % 19,
        C = f(y / 100),
        H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30,
        I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11)),
        J = (y + f(y / 4) + I + 2 - C + f(C / 4)) % 7,
        L = I - J,
        m = 3 + f((L + 40) / 44),
        d = L + 28 - 31 * f(m / 4);
      const e1 = new Date(y, m - 1, d);
      const e2 = new Date(e1); e2.setDate(e1.getDate() + 1);
      return [e1, e2];
    }

    function format(d) {
      return d.toLocaleDateString("nl-NL");
    }

    function getZomerfeesten(year) {
      const start = new Date(year, 6, 1);
      while (start.getDay() !== 6) start.setDate(start.getDate() + 1);
      start.setDate(start.getDate() + 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      return [start, end];
    }

    const [eerstePasen, tweedePasen] = getPasen(jaar);
    const pinksteren = new Date(eerstePasen); pinksteren.setDate(eerstePasen.getDate() + 49);
    const tweedePinksteren = new Date(pinksteren); tweedePinksteren.setDate(pinksteren.getDate() + 1);
    const hemelvaart = new Date(eerstePasen); hemelvaart.setDate(eerstePasen.getDate() + 39);
    const moederdag = new Date(jaar, 4, 1); while (moederdag.getDay() !== 0) moederdag.setDate(moederdag.getDate() + 1); moederdag.setDate(moederdag.getDate() + 7);
    const vaderdag = new Date(jaar, 5, 1); while (vaderdag.getDay() !== 0) vaderdag.setDate(vaderdag.getDate() + 1); vaderdag.setDate(vaderdag.getDate() + 14);
    const [zomerStart, zomerEind] = getZomerfeesten(jaar);

    const feestdagen = [
      ["Pasen", `${format(eerstePasen)} t/m ${format(tweedePasen)}`],
      ["Koningsdag", `${["zo","ma","di","wo","do","vr","za"][new Date(`${jaar}-04-27`).getDay()]} 27-04-${jaar}`],
      ["Meivakantie", `28-04-${jaar} t/m 05-05-${jaar}`],
      ["Bevrijdingsdag", `${["zo","ma","di","wo","do","vr","za"][new Date(`${jaar}-05-05`).getDay()]} 05-05-${jaar}`],
      ["Moederdag", format(moederdag)],
      ["Hemelvaartsdag", `do ${format(hemelvaart)}`],
      ["Pinksteren", `${format(pinksteren)} t/m ${format(tweedePinksteren)}`],
      ["Vaderdag", format(vaderdag)],
      ["Zomerfeesten Nijmegen", `${format(zomerStart)} t/m ${format(zomerEind)}`]
    ];

    const tweeKolommen = feestdagen.reduce((acc, cur, i) => {
      if (i % 2 === 0) acc.push([`${cur[0]}: ${cur[1]}`, feestdagen[i + 1] ? `${feestdagen[i + 1][0]}: ${feestdagen[i + 1][1]}` : ""]);
      return acc;
    }, []);

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Feestdagen seizoen ${jaar}`, 14, doc.lastAutoTable?.finalY + 12 || 250);

    doc.autoTable({
      startY: doc.lastAutoTable?.finalY + 16 || 254,
      body: tweeKolommen,
      styles: { valign: 'top', cellPadding: 2 },
      columnStyles: { 0: { cellWidth: 85 }, 1: { cellWidth: 85 } }
    });

    const pdfBase64 = await doc.output("datauristring");
    const bestandNaam = `${(parsed["Voornaam"] || "onbekend").trim()}-${(parsed["Achternaam"] || "").trim()}.pdf`;

    // ✅ eerst DB opslaan
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

    const dbResult = await res.json();

    if (!dbResult.success) {
      alert("Fout bij opslaan: " + dbResult.error);
      return;
    }

    // ✅ daarna mailen
    await fetch("/api/mail-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voornaam: parsed["Voornaam"] || "onbekend",
        email: to,
        bestand: pdfBase64
      })
    });

    // ✅ tenslotte downloaden
    doc.save(bestandNaam);
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
  <Link href="/" className="text-blue-600 underline text-sm mt-2 self-center">
    ← Terug naar startpagina
  </Link>
</div>
    </div>
  );
}
