"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const dagenKort = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const weekdagen = [
  "Maandag",
  "Dinsdag",
  "Woensdag",
  "Donderdag",
  "Vrijdag",
  "Zaterdag",
  "Zondag",
];

function formatDateNl(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  return d.toLocaleDateString("nl-NL");
}

function formatDateShort(value: string) {
  const d = new Date(`${value}T00:00:00`);
  return d.toLocaleDateString("nl-NL");
}

function formatDateWithDay(value: string) {
  const d = new Date(`${value}T00:00:00`);
  return `${dagenKort[d.getDay()]} ${d.toLocaleDateString("nl-NL")}`;
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

function getJaarVoorFeestdagen(data: any) {
  const basis =
    data?.beschikbaar_vanaf ||
    data?.gesprek_datum ||
    data?.aangemaakt_op ||
    new Date().toISOString();

  return new Date(basis).getFullYear();
}

function groepeerFeestdagen(rows: { naam: string; datum: string }[]) {
  const byNaam = rows.reduce<Record<string, string[]>>((acc, row) => {
    if (!acc[row.naam]) acc[row.naam] = [];
    acc[row.naam].push(row.datum);
    return acc;
  }, {});

  const regels: { label: string; waarde: string }[] = [];

  const addSingle = (naam: string, label = naam, withDay = true) => {
    const datum = byNaam[naam]?.[0];
    if (!datum) return;

    regels.push({
      label,
      waarde: withDay ? formatDateWithDay(datum) : formatDateShort(datum),
    });
  };

  const addRange = (naam: string, label = naam) => {
    const datums = byNaam[naam];
    if (!datums?.length) return;

    regels.push({
      label,
      waarde:
        datums.length === 1
          ? formatDateShort(datums[0])
          : `${formatDateShort(datums[0])} t/m ${formatDateShort(
              datums[datums.length - 1]
            )}`,
    });
  };

  const pasen = rows.filter((r) => r.naam.toLowerCase().includes("paas"));
  if (pasen.length) {
    regels.push({
      label: "Pasen",
      waarde: pasen.map((r) => formatDateShort(r.datum)).join(" en "),
    });
  }

  addSingle("Koningsdag", "Koningsdag", true);
  addRange("Meivakantie", "Meivakantie");
  addSingle("Bevrijdingsdag", "Bevrijdingsdag", true);
  addSingle("Moederdag", "Moederdag", false);
  addSingle("Hemelvaartsdag", "Hemelvaartsdag", true);

  const pinksteren = rows.filter((r) =>
    r.naam.toLowerCase().includes("pinkster")
  );
  if (pinksteren.length) {
    regels.push({
      label: "Pinksteren",
      waarde: pinksteren.map((r) => formatDateShort(r.datum)).join(" en "),
    });
  }

  addSingle("Vaderdag", "Vaderdag", false);
  addRange("Zomerfeesten Nijmegen", "Zomerfeesten Nijmegen");

  return regels;
}

export default function GespreksdocumentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [id, setId] = useState<string | null>(null);

  useMemo(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  const { data } = useSWR(id ? `/api/sollicitaties/${id}` : null, fetcher);
  const jaar = data ? getJaarVoorFeestdagen(data) : new Date().getFullYear();

  const { data: feestdagenData } = useSWR(
    data ? `/api/feestdagen?jaar=${jaar}` : null,
    fetcher
  );

  if (!data) return <div className="p-6">Laden...</div>;

  const feestdagen = groepeerFeestdagen(feestdagenData?.feestdagen || []);

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 7mm;
          }

          body {
            background: #ffffff !important;
          }

          .no-print {
            display: none !important;
          }

          .print-document {
            display: block !important;
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            transform: scale(0.9);
            transform-origin: top left;
          }

          .print-page {
            width: 111% !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>

      <main className="mx-auto max-w-5xl space-y-4 p-6">
        <div className="no-print flex gap-2">
          <Link
            href={`/admin/sollicitaties/${id}`}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            ← Terug
          </Link>

          <button
            onClick={() => window.print()}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Print gespreksdocument
          </button>
        </div>

        <div className="print-document">
          <div className="print-page rounded-xl border bg-white p-6 text-sm">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-xl font-bold">
                  Sollicitatieformulier IJssalon Vincenzo
                </h1>
                <p className="text-slate-500">Gespreksdocument</p>
              </div>
              <div className="min-w-56 border-b border-slate-400 pb-1">
                Datum gesprek:
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <section className="rounded-lg border p-3">
                <h2 className="mb-2 font-bold">Gegevens</h2>
                <table className="w-full text-sm">
                  <tbody>
                    <tr>
                      <td className="w-36 font-semibold">Voornaam</td>
                      <td>{data.voornaam || ""}</td>
                    </tr>
                    <tr>
                      <td className="font-semibold">Achternaam</td>
                      <td>{data.achternaam || ""}</td>
                    </tr>
                    <tr>
                      <td className="font-semibold">Adres</td>
                      <td>
                        {data.adres || ""} {data.huisnummer || ""}
                      </td>
                    </tr>
                    <tr>
                      <td className="font-semibold">PC/Woonplaats</td>
                      <td>
                        {data.postcode || ""} {data.woonplaats || ""}
                      </td>
                    </tr>
                    <tr>
                      <td className="font-semibold">Geboortedatum</td>
                      <td>
                        {formatDateNl(data.geboortedatum)}
                        {data.geboortedatum
                          ? ` (${berekenLeeftijd(data.geboortedatum)} jaar)`
                          : ""}
                      </td>
                    </tr>
                    <tr>
                      <td className="font-semibold">Geslacht</td>
                      <td>{data.geslacht || ""}</td>
                    </tr>
                    <tr>
                      <td className="font-semibold">E-mailadres</td>
                      <td>{data.email || ""}</td>
                    </tr>
                    <tr>
                      <td className="font-semibold">Telefoonnummer</td>
                      <td>{data.telefoon || ""}</td>
                    </tr>
                    <tr>
                      <td className="font-semibold">Startdatum</td>
                      <td>{formatDateNl(data.beschikbaar_vanaf)}</td>
                    </tr>
                    <tr>
                      <td className="font-semibold">Einddatum</td>
                      <td>{formatDateNl(data.beschikbaar_tot)}</td>
                    </tr>
                    <tr>
                      <td className="font-semibold">Andere bijbaan</td>
                      <td>{data.bijbaan || ""}</td>
                    </tr>
                  </tbody>
                </table>
              </section>

              <section className="rounded-lg border p-3">
                <h2 className="mb-2 font-bold">Beschikbaar</h2>
                <table className="w-full border-collapse text-center text-sm">
                  <thead>
                    <tr className="bg-slate-900 text-white">
                      <th className="border p-1 text-left">Dag</th>
                      <th className="border p-1">Shift 1</th>
                      <th className="border p-1">Shift 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weekdagen.map((dag) => {
                      const momenten: string[] =
                        data.beschikbaar_momenten || [];
                      const s1 = momenten.some(
                        (m) => m.startsWith(dag) && m.includes("11:30")
                      );
                      const s2 = momenten.some(
                        (m) => m.startsWith(dag) && m.includes("17:30")
                      );

                      return (
                        <tr key={dag}>
                          <td className="border p-1 text-left">{dag}</td>
                          <td className="border p-1">{s1 ? "JA" : ""}</td>
                          <td className="border p-1">{s2 ? "JA" : ""}</td>
                        </tr>
                      );
                    })}
                    <tr>
                      <td className="border p-1 text-left font-semibold">
                        Shifts per week
                      </td>
                      <td className="border p-1" colSpan={2}>
                        {data.shifts_per_week || ""}
                      </td>
                    </tr>
                    <tr>
                      <td className="border p-1 text-left font-semibold">
                        Afd. voorkeur
                      </td>
                      <td className="border p-1" colSpan={2}>
                        {data.voorkeur_functie || ""}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </section>
            </div>

            <section className="mt-4 rounded-lg border p-3">
              <h2 className="mb-2 font-bold">Gesprek</h2>
              <div className="grid grid-cols-2 gap-3">
                {[
                  "Werkervaring",
                  "Opleiding",
                  "Rekenvaardigheid",
                  "Kassa-ervaring",
                  "Duits",
                  "Extra",
                ].map((label) => (
                  <div key={label}>
                    <div className="font-semibold">{label}</div>
                    <div className="h-12 border-b border-dashed border-slate-400" />
                  </div>
                ))}
              </div>

              <div className="mt-3">
                <div className="font-semibold">Opmerking / Motivatie</div>
                <div className="mt-1 whitespace-pre-wrap rounded border p-2 text-sm">
                  {data.motivatie || ""}
                </div>
              </div>
            </section>

            <section className="mt-4 rounded-lg border p-3">
              <h2 className="mb-2 font-bold">Feestdagen seizoen {jaar}</h2>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
                {feestdagen.map((f) => (
                  <div key={f.label}>
                    <strong>{f.label}:</strong> {f.waarde}
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>
    </>
  );
}