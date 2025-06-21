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

function getLeeftijd(dob: string): number {
  const [dag, maand, jaar] = dob.split("-").map(Number);
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
    // ... (alles blijft hetzelfde tot het einde van de PDF-opbouw)

    const pdfBase64 = await doc.output("datauristring");
    const bestandNaam = `${parsed["Voornaam"] || "onbekend"}-${parsed["Achternaam"] || ""}.pdf`;

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

  // ... rest van de code blijft hetzelfde


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
        
      </div>
    </div>
  );
}
