"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Weergave = "bedragen" | "percentages";

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

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`;
}

export default function MeerjarenJaarrekeningPage() {
  const { data, error } = useSWR("/api/admin/jaarrekeningen", fetcher);

  const [weergave, setWeergave] = useState<Weergave>("bedragen");
  const [openRubrieken, setOpenRubrieken] = useState<Record<number, boolean>>(
    {}
  );

  const onderdelen: Onderdeel[] = data?.onderdelen || [];
  const rubrieken: Rubriek[] = data?.rubrieken || [];
  const regels: Regel[] = data?.regels || [];
  const jaren: number[] = data?.jaren || [];

  const onderdeelWV = onderdelen.find((o) => o.code === "winst_en_verlies");
  const onderdeelActiva = onderdelen.find((o) => o.code === "balans_activa");
  const onderdeelPassiva = onderdelen.find((o) => o.code === "balans_passiva");

  function rubriekenVanOnderdeel(onderdeelId?: number) {
    if (!onderdeelId) return [];
    return rubrieken.filter((r) => r.onderdeel_id === onderdeelId);
  }

  function regelsVanRubriek(rubriekId: number) {
    return regels.filter((r) => r.rubriek_id === rubriekId && !r.is_totaal);
  }

  function rubriekTotaal(rubriekId: number, jaar: number) {
    return regelsVanRubriek(rubriekId).reduce(
      (som, r) => som + bedrag(r, jaar),
      0
    );
  }

  function toggleRubriek(rubriekId: number) {
    setOpenRubrieken((prev) => ({
      ...prev,
      [rubriekId]: !prev[rubriekId],
    }));
  }

  const wvRubrieken = rubriekenVanOnderdeel(onderdeelWV?.id);
  const activaRubrieken = rubriekenVanOnderdeel(onderdeelActiva?.id);
  const passivaRubrieken = rubriekenVanOnderdeel(onderdeelPassiva?.id);

  const omzetRubriek = wvRubrieken.find(
    (r) => r.naam.trim().toLowerCase() === "omzet excl. btw"
  );

  function omzetVoorJaar(jaar: number) {
    return omzetRubriek ? rubriekTotaal(omzetRubriek.id, jaar) : 0;
  }

  function totaalActivaVoorJaar(jaar: number) {
    return activaRubrieken.reduce((som, r) => som + rubriekTotaal(r.id, jaar), 0);
  }

  function totaalPassivaVoorJaar(jaar: number) {
    return passivaRubrieken.reduce(
      (som, r) => som + rubriekTotaal(r.id, jaar),
      0
    );
  }

  function basisVoorPercentage(
    jaar: number,
    percentageBasis: "omzet" | "activa" | "passiva"
  ) {
    if (percentageBasis === "activa") return totaalActivaVoorJaar(jaar);
    if (percentageBasis === "passiva") return totaalPassivaVoorJaar(jaar);
    return omzetVoorJaar(jaar);
  }

  function formatWaarde(
    value: number,
    jaar: number,
    percentageBasis: "omzet" | "activa" | "passiva"
  ) {
    if (weergave === "bedragen") return formatEuro(value);

    const basis = basisVoorPercentage(jaar, percentageBasis);
    if (!basis) return "-";

    return formatPercentage((value / basis) * 100);
  }

  const samenvatting = useMemo(() => {
    return jaren.map((jaar) => {
      const omzet = omzetVoorJaar(jaar);

      const kosten = wvRubrieken
        .filter((r) => r.id !== omzetRubriek?.id)
        .reduce((som, r) => som + rubriekTotaal(r.id, jaar), 0);

      const winst = omzet - kosten;
      const activa = totaalActivaVoorJaar(jaar);
      const passiva = totaalPassivaVoorJaar(jaar);

      return { jaar, omzet, kosten, winst, activa, passiva };
    });
  }, [jaren, regels, rubrieken]);

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
                Meerjarenrapport jaarrekeningen
              </h1>
              <p className="text-sm text-slate-500">
                Alle jaren naast elkaar per hoofdrubriek, uitklapbaar naar
                onderliggende regels.
              </p>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setWeergave("bedragen")}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  weergave === "bedragen"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Bedragen
              </button>

              <button
                onClick={() => setWeergave("percentages")}
                className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                  weergave === "percentages"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                Percentages
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-200">
              <tr>
                <th className="sticky left-0 z-10 min-w-64 bg-slate-200 px-4 py-3 text-left">
                  Samenvatting
                </th>
                {jaren.map((jaar) => (
                  <th key={jaar} className="px-4 py-3 text-right">
                    {jaar}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <SamenvattingRij
                label="Omzet totaal"
                jaren={jaren}
                data={samenvatting}
                veld="omzet"
                formatWaarde={formatWaarde}
                percentageBasis="omzet"
              />
              <SamenvattingRij
                label="Kosten totaal"
                jaren={jaren}
                data={samenvatting}
                veld="kosten"
                formatWaarde={formatWaarde}
                percentageBasis="omzet"
              />
              <SamenvattingRij
                label="Saldo winst"
                jaren={jaren}
                data={samenvatting}
                veld="winst"
                formatWaarde={formatWaarde}
                percentageBasis="omzet"
                vet
              />
              <SamenvattingRij
                label="Totaal activa"
                jaren={jaren}
                data={samenvatting}
                veld="activa"
                formatWaarde={formatWaarde}
                percentageBasis="activa"
              />
              <SamenvattingRij
                label="Totaal passiva"
                jaren={jaren}
                data={samenvatting}
                veld="passiva"
                formatWaarde={formatWaarde}
                percentageBasis="passiva"
              />
            </tbody>
          </table>
        </div>

        <MeerjarenBlok
          titel="Verlies- en winstrekening"
          rubrieken={wvRubrieken}
          regels={regels}
          jaren={jaren}
          openRubrieken={openRubrieken}
          toggleRubriek={toggleRubriek}
          rubriekTotaal={rubriekTotaal}
          formatWaarde={formatWaarde}
          percentageBasis="omzet"
        />

        <MeerjarenBlok
          titel="Balans - activa"
          rubrieken={activaRubrieken}
          regels={regels}
          jaren={jaren}
          openRubrieken={openRubrieken}
          toggleRubriek={toggleRubriek}
          rubriekTotaal={rubriekTotaal}
          formatWaarde={formatWaarde}
          percentageBasis="activa"
        />

        <MeerjarenBlok
          titel="Balans - passiva"
          rubrieken={passivaRubrieken}
          regels={regels}
          jaren={jaren}
          openRubrieken={openRubrieken}
          toggleRubriek={toggleRubriek}
          rubriekTotaal={rubriekTotaal}
          formatWaarde={formatWaarde}
          percentageBasis="passiva"
        />
      </div>
    </div>
  );
}

function SamenvattingRij({
  label,
  jaren,
  data,
  veld,
  formatWaarde,
  percentageBasis,
  vet = false,
}: {
  label: string;
  jaren: number[];
  data: Record<string, number>[];
  veld: "omzet" | "kosten" | "winst" | "activa" | "passiva";
  formatWaarde: (
    value: number,
    jaar: number,
    percentageBasis: "omzet" | "activa" | "passiva"
  ) => string;
  percentageBasis: "omzet" | "activa" | "passiva";
  vet?: boolean;
}) {
  return (
    <tr className="border-t border-slate-200">
      <td
        className={`sticky left-0 bg-white px-4 py-2 ${
          vet ? "font-bold text-slate-900" : "text-slate-700"
        }`}
      >
        {label}
      </td>
      {jaren.map((jaar) => {
        const rij = data.find((d) => d.jaar === jaar);
        const waarde = rij?.[veld] || 0;

        return (
          <td
            key={jaar}
            className={`px-4 py-2 text-right ${
              vet ? "font-bold text-slate-900" : "text-slate-700"
            }`}
          >
            {formatWaarde(waarde, jaar, percentageBasis)}
          </td>
        );
      })}
    </tr>
  );
}

function MeerjarenBlok({
  titel,
  rubrieken,
  regels,
  jaren,
  openRubrieken,
  toggleRubriek,
  rubriekTotaal,
  formatWaarde,
  percentageBasis,
}: {
  titel: string;
  rubrieken: Rubriek[];
  regels: Regel[];
  jaren: number[];
  openRubrieken: Record<number, boolean>;
  toggleRubriek: (rubriekId: number) => void;
  rubriekTotaal: (rubriekId: number, jaar: number) => number;
  formatWaarde: (
    value: number,
    jaar: number,
    percentageBasis: "omzet" | "activa" | "passiva"
  ) => string;
  percentageBasis: "omzet" | "activa" | "passiva";
}) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
        <h2 className="text-lg font-bold text-slate-900">{titel}</h2>
      </div>

      <table className="min-w-full text-sm">
        <thead className="bg-slate-100">
          <tr>
            <th className="sticky left-0 z-10 min-w-72 bg-slate-100 px-4 py-3 text-left">
              Rubriek / regel
            </th>
            {jaren.map((jaar) => (
              <th key={jaar} className="px-4 py-3 text-right">
                {jaar}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rubrieken.map((rubriek) => {
            const open = !!openRubrieken[rubriek.id];
            const regelsVanRubriek = regels.filter(
              (r) => r.rubriek_id === rubriek.id && !r.is_totaal
            );

            return (
              <Fragment key={rubriek.id}>
                <tr className="border-t border-slate-200 bg-white">
                  <td className="sticky left-0 bg-white px-4 py-3">
                    <button
                      onClick={() => toggleRubriek(rubriek.id)}
                      className="flex items-center gap-2 font-bold text-slate-900 hover:text-blue-700"
                    >
                      <span className="inline-block w-4">
                        {open ? "▾" : "▸"}
                      </span>
                      {rubriek.naam}
                    </button>
                  </td>

                  {jaren.map((jaar) => (
                    <td
                      key={jaar}
                      className="px-4 py-3 text-right font-bold text-slate-900"
                    >
                      {formatWaarde(
                        rubriekTotaal(rubriek.id, jaar),
                        jaar,
                        percentageBasis
                      )}
                    </td>
                  ))}
                </tr>

                {open &&
                  regelsVanRubriek.map((regel) => (
                    <tr key={regel.id} className="border-t border-slate-100">
                      <td className="sticky left-0 bg-slate-50 px-8 py-2 text-slate-700">
                        {regel.naam}
                      </td>

                      {jaren.map((jaar) => (
                        <td
                          key={jaar}
                          className="bg-slate-50 px-4 py-2 text-right text-slate-700"
                        >
                          {formatWaarde(
                            bedrag(regel, jaar),
                            jaar,
                            percentageBasis
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}