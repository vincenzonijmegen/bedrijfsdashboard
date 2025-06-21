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

function getLeeftijd(dob: string): number | string {
  const [dag, maand, jaar] = dob.split("-").map(Number);
  if (!dag || !maand || !jaar) return "onbekend";
  const geboortedatum = new Date(jaar, maand - 1, dag);
  const nu = new Date();
  let leeftijd = nu.getFullYear() - geboortedatum.getFullYear();
  const maandVerschil = nu.getMonth() - geboortedatum.getMonth();
  if (maandVerschil < 0 || (maandVerschil === 0 && nu.getDate() < geboortedatum.getDate())) {
    leeftijd--;
  }
  return leeftijd;
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
    doc.text("Sollicitatieformulier IJssalon Vincenzo            Datum gesprek:", 14, 20);
    doc.setFontSize(11);

    const y = 30;
    const personal = [
      ["Voornaam", parsed["Voornaam"] || ""],
      ["Achternaam", parsed["Achternaam"] || ""],
      ["Adres", `${parsed["Adres"] || ""} ${parsed["Huisnummer"] || ""}`],
      ["PC/Woonplaats", `${parsed["Postcode"] || ""} ${parsed["Woonplaats"] || ""}`],
      ["Geboortedatum", `${parsed["Geboortedatum"] || ""} (${parsed["Geboortedatum"] ? getLeeftijd(parsed["Geboortedatum"]) + ' jaar' : ''})`],
      ["E-mailadres", parsed["E-mailadres"] || ""],
      ["Telefoonnummer", parsed["Telefoonnummer"] || ""],
      ["Startdatum", parsed["Startdatum"] || ""],
      ["Einddatum", parsed["Einddatum"] || ""],
      ["Andere bijbaan", parsed["Andere bijbaan"] || ""]
    ];

    autoTable(doc, {
      startY: y,
      head: [["Gegevens", ""]],
      margin: { left: 14 },
      tableWidth: 90,
      body: personal,
      styles: { cellPadding: 2 },
      columnStyles: { 0: { fontStyle: 'bold' } },
      headStyles: { cellPadding: 2, fontStyle: 'bold', halign: 'left', minCellHeight: 8 }
    });

    const dagen = parsed["Dagen werken"]?.toLowerCase().split(",") || [];
    const dagrijen = ["maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"].map((dag) => [
      dag,
      dagen.includes(`${dag} shift 1`) ? "JA" : "",
      dagen.includes(`${dag} shift 2`) ? "JA" : ""
    ]);
    dagrijen.push(["shifts per week", parsed["Shifts per week"] || "", ""]);
    dagrijen.push(["afd. voorkeur", parsed["Voorkeur functie"] || "", ""]);

    autoTable(doc, {
      startY: y,
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
    const extraStartY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y;

    autoTable(doc, {
      startY: extraStartY + 16,
      body: extra,
      styles: { valign: 'top', cellPadding: 2 },
      columnStyles: {
        0: { fontStyle: 'bold' },
        1: { cellWidth: 140 }
      },
      didParseCell(data) {
        if ([0, 1].includes(data.row.index)) data.cell.styles.minCellHeight = 20;
      }
    });

    const jaar = new Date().getFullYear();
    function getPasen(year: number): Date[] {
      const f = Math.floor,
        G = year % 19,
        C = f(year / 100),
        H = (C - f(C / 4) - f((8 * C + 13) / 25) + 19 * G + 15) % 30,
        I = H - f(H / 28) * (1 - f(29 / (H + 1)) * f((21 - G) / 11)),
        J = (year + f(year / 4) + I + 2 - C + f(C / 4)) % 7,
        L = I - J,
        maand = 3 + f((L + 40) / 44),
        dag = L + 28 - 31 * f(maand / 4);
      const eerste = new Date(year, maand - 1, dag);
      const tweede = new Date(eerste);
      tweede.setDate(eerste.getDate() + 1);
      return [eerste, tweede];
    }

    function format(d: Date): string {
      return d.toLocaleDateString("nl-NL");
    }

    const [eerstePasen, tweedePasen] = getPasen(jaar);
    const pinksteren = new Date(eerstePasen);
    pinksteren.setDate(eerstePasen.getDate() + 49);
    const tweedePinksteren = new Date(pinksteren);
    tweedePinksteren.setDate(pinksteren.getDate() + 1);

    const hemelvaart = new Date(eerstePasen);
    hemelvaart.setDate(eerstePasen.getDate() + 39);

    const moederdag = new Date(jaar, 4, 1);
    while (moederdag.getDay() !== 0) moederdag.setDate(moederdag.getDate() + 1);
    moederdag.setDate(moederdag.getDate() + 7);

    const vaderdag = new Date(jaar, 5, 1);
    while (vaderdag.getDay() !== 0) vaderdag.setDate(vaderdag.getDate() + 1);
    vaderdag.setDate(vaderdag.getDate() + 14);

    function getZomerfeesten(year: number): [Date, Date] {
      const eersteDag = new Date(year, 6, 1);
      while (eersteDag.getDay() !== 6) eersteDag.setDate(eersteDag.getDate() + 1);
      eersteDag.setDate(eersteDag.getDate() + 7);
      const laatsteDag = new Date(eersteDag);
      laatsteDag.setDate(eersteDag.getDate() + 6);
      return [eersteDag, laatsteDag];
    }

    const feestdagen: [string, string][] = [
      ["Pasen", `${format(eerstePasen)} en ${format(tweedePasen)}`],
      ["Koningsdag", `${["zo","ma","di","wo","do","vr","za"][new Date(`${jaar}-04-27`).getDay()]} 27-04-${jaar}`],
      ["Meivakantie", `28-04-${jaar} t/m 05-05-${jaar}`],
      ["Bevrijdingsdag", `${["zo","ma","di","wo","do","vr","za"][new Date(`${jaar}-05-05`).getDay()]} 05-05-${jaar}`],
      ["Moederdag", format(moederdag)],
      ["Hemelvaartsdag", `do ${format(hemelvaart)}`],
      ["Pinksteren", `${format(pinksteren)} en ${format(tweedePinksteren)}`],
      ["Vaderdag", format(vaderdag)],
      ["Zomerfeesten Nijmegen", (() => {
        const [start, eind] = getZomerfeesten(jaar);
        return `${format(start)} t/m ${format(eind)}`;
      })()]
    ];

    const feestdagenStartY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || y;
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`Feestdagen seizoen ${jaar}`, 14, feestdagenStartY + 12);

    const feestdagenInTweeKolommen = feestdagen.reduce<[string, string][]>((acc, cur, i) => {
      if (i % 2 === 0) {
        acc.push([
          `${cur[0]}: ${cur[1]}`,
          feestdagen[i + 1] ? `${feestdagen[i + 1][0]}: ${feestdagen[i + 1][1]}` : ""
        ]);
      }
      return acc;
    }, []);

    autoTable(doc, {
      startY: feestdagenStartY + 16,
      body: feestdagenInTweeKolommen,
      styles: { valign: 'top', cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 85 },
        1: { cellWidth: 85 }
      }
    });

    const pdfBase64 = doc.output("datauristring");

    await fetch("/api/mail-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        voornaam: parsed["Voornaam"] || "onbekend",
        email: to,
        bestand: pdfBase64
      })
    });

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
          [`beschikbaar_${dag}_2`, dagen.includes(`${dag} shift 2`)]
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
      alert(`PDF verzonden én data opgeslagen in database. Naar ${to}`);
      doc.save(`${parsed["Voornaam"] || "onbekend"}-${parsed["Achternaam"] || ""}.pdf`);
    } else {
      alert("Fout bij opslaan: " + json.error);
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
      <button
        onClick={generatePDF}
        className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        📤 Genereer & Verstuur PDF
      </button>
      <div className="mt-6">
        <a
          href="/"
          className="inline-block text-blue-600 hover:underline text-sm"
        >
          ← Terug naar startpagina
        </a>
      </div>
    </div>
  );
}
