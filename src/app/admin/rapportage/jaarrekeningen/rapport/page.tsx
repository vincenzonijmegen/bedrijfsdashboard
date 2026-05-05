"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Onderdeel = {
  id: number;
  code: "winst_en_verlies" | "balans_activa" | "balans_passiva";
  naam: string;
};

type Rubriek = {
  id: number;
  onderdeel_id: number;
  naam: string;
};

type Regel = {
  id: number;
  rubriek_id: number;
  naam: string;
  is_totaal: boolean;
  bedragen: Record<string, string | number | null>;
};

function bedrag(regel: Regel, jaar: number) {
  const value = regel.bedragen?.[jaar];
  if (value === null || value === undefined || value === "") return 0;
  return Number(value);
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function JaarrekeningenRapportPage() {
  const { data, error } = useSWR("/api/admin/jaarrekeningen", fetcher);

  const [jaar, setJaar] = useState<number | null>(null);

  const onderdelen: Onderdeel[] = data?.onderdelen || [];
  const rubrieken: Rubriek[] = data?.rubrieken || [];
  const regels: Regel[] = data?.regels || [];
  const jaren: number[] = data?.jaren || [];

  const gekozenJaar = jaar || jaren[jaren.length - 1];

  const onderdeelWV = onderdelen.find((o) => o.code === "winst_en_verlies");
  const onderdeelActiva = onderdelen.find((o) => o.code === "balans_activa");
  const onderdeelPassiva = onderdelen.find((o) => o.code === "balans_passiva");

  function regelsVanRubriek(rubriekId: number) {
    return regels.filter((r) => r.rubriek_id === rubriekId);
  }

  function rubriekTotaal(rubriekId: number) {
    return regelsVanRubriek(rubriekId)
      .filter((r) => !r.is_totaal)
      .reduce((som, r) => som + bedrag(r, gekozenJaar), 0);
  }

  function rubriekenVanOnderdeel(onderdeelId?: number) {
    if (!onderdeelId) return [];
    return rubrieken.filter((r) => r.onderdeel_id === onderdeelId);
  }

  const wvRubrieken = rubriekenVanOnderdeel(onderdeelWV?.id);
  const activaRubrieken = rubriekenVanOnderdeel(onderdeelActiva?.id);
  const passivaRubrieken = rubriekenVanOnderdeel(onderdeelPassiva?.id);

  const omzetRubriek = wvRubrieken.find(
  (r) => r.naam.trim().toLowerCase() === "omzet excl. btw"
);

const omzetTotaal = omzetRubriek ? rubriekTotaal(omzetRubriek.id) : 0;

const kostenTotaal = wvRubrieken
  .filter((r) => r.id !== omzetRubriek?.id)
  .reduce((som, r) => som + rubriekTotaal(r.id), 0);

  const saldoWinst = omzetTotaal - kostenTotaal;

  const totaalActiva = activaRubrieken.reduce(
    (som, r) => som + rubriekTotaal(r.id),
    0
  );

  const totaalPassiva = passivaRubrieken.reduce(
    (som, r) => som + rubriekTotaal(r.id),
    0
  );

  if (error) return <div className="p-6 text-red-600">Fout bij laden.</div>;
  if (!data) return <div className="p-6">Laden...</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Link
            href="/admin/rapportage/financieel"
            className="text-sm text-blue-700 hover:underline"
          >
            ← Terug naar financiële rapportages
          </Link>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Rapport jaarrekeningen
              </h1>
              <p className="text-sm text-slate-500">
                Overzicht van winst & verlies en balans met berekende totalen.
              </p>
            </div>

            <select
              value={gekozenJaar || ""}
              onChange={(e) => setJaar(Number(e.target.value))}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              {jaren.map((j) => (
                <option key={j} value={j}>
                  {j}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Kpi titel="Omzet totaal" waarde={formatEuro(omzetTotaal)} />
          <Kpi titel="Kosten totaal" waarde={formatEuro(kostenTotaal)} />
          <Kpi
            titel="Saldo winst"
            waarde={formatEuro(saldoWinst)}
            positief={saldoWinst >= 0}
          />
          <Kpi
            titel="Winstmarge"
            waarde={
              omzetTotaal
                ? `${((saldoWinst / omzetTotaal) * 100).toFixed(1)}%`
                : "-"
            }
          />
        </div>

        <RapportBlok
          titel="Verlies- en winstrekening"
          rubrieken={wvRubrieken}
          regels={regels}
          gekozenJaar={gekozenJaar}
          rubriekTotaal={rubriekTotaal}
        />

        <div className="grid gap-6 xl:grid-cols-2">
          <RapportBlok
            titel="Balans - activa"
            rubrieken={activaRubrieken}
            regels={regels}
            gekozenJaar={gekozenJaar}
            rubriekTotaal={rubriekTotaal}
            eindtotaalLabel="Totaal activazijde"
            eindtotaal={totaalActiva}
          />

          <RapportBlok
            titel="Balans - passiva"
            rubrieken={passivaRubrieken}
            regels={regels}
            gekozenJaar={gekozenJaar}
            rubriekTotaal={rubriekTotaal}
            eindtotaalLabel="Totaal passivazijde"
            eindtotaal={totaalPassiva}
          />
        </div>

        <div
          className={`rounded-2xl border p-5 shadow-sm ${
            Math.round(totaalActiva) === Math.round(totaalPassiva)
              ? "border-emerald-200 bg-emerald-50"
              : "border-red-200 bg-red-50"
          }`}
        >
          <h2 className="font-bold text-slate-900">Balanscontrole</h2>
          <p className="mt-1 text-sm text-slate-700">
            Activa: <strong>{formatEuro(totaalActiva)}</strong> · Passiva:{" "}
            <strong>{formatEuro(totaalPassiva)}</strong> · Verschil:{" "}
            <strong>{formatEuro(totaalActiva - totaalPassiva)}</strong>
          </p>
        </div>
      </div>
    </div>
  );
}

function Kpi({
  titel,
  waarde,
  positief,
}: {
  titel: string;
  waarde: string;
  positief?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{titel}</p>
      <p
        className={`mt-2 text-2xl font-bold ${
          positief === false ? "text-red-700" : "text-slate-900"
        }`}
      >
        {waarde}
      </p>
    </div>
  );
}

function RapportBlok({
  titel,
  rubrieken,
  regels,
  gekozenJaar,
  rubriekTotaal,
  eindtotaalLabel,
  eindtotaal,
}: {
  titel: string;
  rubrieken: Rubriek[];
  regels: Regel[];
  gekozenJaar: number;
  rubriekTotaal: (rubriekId: number) => number;
  eindtotaalLabel?: string;
  eindtotaal?: number;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <h2 className="text-lg font-bold text-slate-900">{titel}</h2>
      </div>

      <table className="min-w-full text-sm">
        <tbody>
          {rubrieken.map((rubriek) => {
            const regelsVanRubriek = regels.filter(
              (r) => r.rubriek_id === rubriek.id && !r.is_totaal
            );

            return (
              <Fragment key={rubriek.id}>
                <tr className="bg-slate-100">
                  <td className="px-5 py-3 font-bold text-slate-900">
                    {rubriek.naam}
                  </td>
                  <td className="px-5 py-3 text-right font-bold text-slate-900">
                    {formatEuro(rubriekTotaal(rubriek.id))}
                  </td>
                </tr>

                {regelsVanRubriek.map((regel) => {
                  const waarde = bedrag(regel, gekozenJaar);

                  return (
                    <tr key={regel.id} className="border-t border-slate-100">
                      <td className="px-5 py-2 text-slate-700">
                        {regel.naam}
                      </td>
                      <td className="px-5 py-2 text-right text-slate-700">
                        {formatEuro(waarde)}
                      </td>
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}

          {eindtotaalLabel && eindtotaal !== undefined && (
            <tr className="border-t-2 border-slate-300 bg-slate-900 text-white">
              <td className="px-5 py-3 font-bold">{eindtotaalLabel}</td>
              <td className="px-5 py-3 text-right font-bold">
                {formatEuro(eindtotaal)}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}