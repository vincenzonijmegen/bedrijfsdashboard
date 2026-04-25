"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatDateNl(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  return d.toLocaleDateString("nl-NL");
}

function berekenLeeftijd(value: string | null) {
  if (!value) return null;

  const geboortedatum = new Date(value);
  const vandaag = new Date();

  let leeftijd = vandaag.getFullYear() - geboortedatum.getFullYear();
  const maandVerschil = vandaag.getMonth() - geboortedatum.getMonth();

  if (
    maandVerschil < 0 ||
    (maandVerschil === 0 && vandaag.getDate() < geboortedatum.getDate())
  ) {
    leeftijd--;
  }

  return leeftijd;
}

const dagen = [
  "maandag",
  "dinsdag",
  "woensdag",
  "donderdag",
  "vrijdag",
  "zaterdag",
  "zondag",
];

export default function GesprekDocument({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [id, setId] = useState<string | null>(null);

  useMemo(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  const { data } = useSWR(
    id ? `/api/sollicitaties/${id}` : null,
    fetcher
  );

  if (!data) return <div className="p-6">Laden...</div>;

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">

      {/* PRINT STYLING */}
      <style jsx global>{`
        @media print {
          body {
            background: white !important;
          }

          header,
          nav,
          aside,
          .print-hidden,
          .print\\:hidden {
            display: none !important;
          }

          main {
            padding: 0 !important;
            margin: 0 !important;
            max-width: none !important;
          }

          @page {
            size: A4;
            margin: 8mm;
          }

          .gesprek-print {
            transform: scale(0.9);
            transform-origin: top left;
            width: 110%;
            page-break-inside: avoid;
          }
        }
      `}</style>

      {/* NAV */}
      <div className="print-hidden flex gap-2">
        <Link
          href={`/admin/sollicitaties/${id}`}
          className="rounded-xl border px-4 py-2 text-sm"
        >
          ← Terug
        </Link>

        <button
          onClick={() => window.print()}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white"
        >
          Print gespreksdocument
        </button>
      </div>

      {/* DOCUMENT */}
      <div className="gesprek-print rounded-xl border bg-white p-6 text-sm print:border-0 print:p-0 space-y-6">

        {/* HEADER */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-lg font-bold">
              Sollicitatieformulier IJssalon Vincenzo
            </h1>
            <div className="text-xs text-gray-500">Gespreksdocument</div>
          </div>

          <div className="text-sm">
            Datum gesprek: __________________
          </div>
        </div>

        {/* GEGEVENS + BESCHIKBAAR */}
        <div className="grid grid-cols-2 gap-4">

          {/* GEGEVENS */}
          <div className="border rounded-xl p-4">
            <h2 className="font-semibold mb-2">Gegevens</h2>
            <div className="space-y-1">
              <div>Voornaam: {data.voornaam}</div>
              <div>Achternaam: {data.achternaam}</div>
              <div>
                Adres: {data.adres} {data.huisnummer}
              </div>
              <div>
                PC/Woonplaats: {data.postcode} {data.woonplaats}
              </div>
              <div>
                Geboortedatum: {formatDateNl(data.geboortedatum)} (
                {berekenLeeftijd(data.geboortedatum)} jaar)
              </div>
              <div>Geslacht: {data.geslacht}</div>
              <div>E-mailadres: {data.email}</div>
              <div>Telefoonnummer: {data.telefoon}</div>
              <div>Startdatum: {formatDateNl(data.beschikbaar_vanaf)}</div>
              <div>Einddatum: {formatDateNl(data.beschikbaar_tot)}</div>
              <div>Andere bijbaan: {data.bijbaan}</div>
            </div>
          </div>

          {/* BESCHIKBAAR */}
          <div className="border rounded-xl p-4">
            <h2 className="font-semibold mb-2">Beschikbaar</h2>

            <table className="w-full text-xs border">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="p-1 text-left">Dag</th>
                  <th className="p-1">Shift 1</th>
                  <th className="p-1">Shift 2</th>
                </tr>
              </thead>
              <tbody>
                {dagen.map((dag) => (
                  <tr key={dag} className="border-t">
                    <td className="p-1 capitalize">{dag}</td>
                    <td className="p-1 text-center">
                      {data.beschikbaar_momenten?.some(
                        (m: string) =>
                          m.toLowerCase().includes(dag) &&
                          m.includes("11:30")
                      )
                        ? "JA"
                        : ""}
                    </td>
                    <td className="p-1 text-center">
                      {data.beschikbaar_momenten?.some(
                        (m: string) =>
                          m.toLowerCase().includes(dag) &&
                          m.includes("17:30")
                      )
                        ? "JA"
                        : ""}
                    </td>
                  </tr>
                ))}

                <tr className="border-t">
                  <td className="p-1">Shifts per week</td>
                  <td colSpan={2} className="p-1 text-center">
                    {data.shifts_per_week}
                  </td>
                </tr>

                <tr className="border-t">
                  <td className="p-1">Afd. voorkeur</td>
                  <td colSpan={2} className="p-1 text-center">
                    {data.voorkeur_functie}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* GESPREK */}
        <div className="border rounded-xl p-4">
          <h2 className="font-semibold mb-3">Gesprek</h2>

          <div className="grid grid-cols-2 gap-4 text-xs">
            {[
              "Werkervaring",
              "Opleiding",
              "Rekenvaardigheid",
              "Kassa-ervaring",
              "Duits",
              "Extra",
            ].map((item) => (
              <div key={item}>
                <div className="mb-2">{item}</div>
                <div className="border-b border-dashed h-10"></div>
              </div>
            ))}
          </div>

          <div className="mt-4">
            <div className="mb-2">Opmerking / Motivatie</div>
            <div className="border rounded p-2 min-h-[60px]">
              {data.motivatie}
            </div>
          </div>
        </div>

        {/* FEESTDAGEN */}
        <div className="border rounded-xl p-4">
          <h2 className="font-semibold mb-2">
            Feestdagen seizoen {new Date().getFullYear()}
          </h2>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>Pasen: 5-4-2026 en 6-4-2026</div>
            <div>Koningsdag: ma 27-04-2026</div>
            <div>Bevrijdingsdag: di 05-05-2026</div>
            <div>Moederdag: 10-05-2026</div>
          </div>
        </div>
      </div>
    </main>
  );
}