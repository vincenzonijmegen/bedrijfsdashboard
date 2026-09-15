"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Regel = {
  volgorde: number;
  jaar: number;
  maand: number;
  datumLabel: string;
  omschrijving: string;
  categorie: string;
  in: number;
  uit: number;
  saldo: number;
  bron: string | null;
};

type ApiData = {
  success: boolean;
  fase?: string;
  error?: string;
  peildatum?: string;
  totJaar?: number;
  startsaldo?: number;
  eindsaldo?: number;
  regels?: Regel[];
  controle4PA?: {
    verwachtEindsaldo: number | null;
    eindsaldoOverzicht: number;
    verschil: number | null;
    aansluitingOk: boolean;
    aantalRegels: number;
    btwRegels: number;
    vpbRegels: number;
  };
};

const euro = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

const maanden = [
  "",
  "Januari",
  "Februari",
  "Maart",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Augustus",
  "September",
  "Oktober",
  "November",
  "December",
];

function bedrag(v: number) {
  return v === 0 ? "" : euro.format(v);
}

export default function CashflowOverzichtPage() {
  const huidigJaar = new Date().getFullYear();
  const [totJaar, setTotJaar] = useState(huidigJaar + 1);
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let actief = true;

    async function laad() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/admin/cashflow/kasstroomoverzicht?tot=${totJaar}`,
          { cache: "no-store" }
        );
        const json = (await res.json()) as ApiData;
        if (actief) setData(json);
      } catch (error) {
        if (actief) {
          setData({
            success: false,
            error:
              error instanceof Error
                ? error.message
                : "Kasstroomoverzicht laden mislukt",
          });
        }
      } finally {
        if (actief) setLoading(false);
      }
    }

    void laad();
    return () => {
      actief = false;
    };
  }, [totJaar]);

  const groepen = useMemo(() => {
    const map = new Map<string, Regel[]>();
    for (const regel of data?.regels ?? []) {
      const key =
        regel.categorie === "start"
          ? "start"
          : `${regel.jaar}-${String(regel.maand).padStart(2, "0")}`;
      const huidig = map.get(key) ?? [];
      huidig.push(regel);
      map.set(key, huidig);
    }
    return [...map.entries()];
  }, [data]);

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                IJssalon Vincenzo B.V.
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">
                Cashflowoverzicht
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Startsaldo en alle geraamde inkomsten en uitgaven met doorlopend saldo.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium text-slate-700">
                Tonen t/m
                <select
                  value={totJaar}
                  onChange={(e) => setTotJaar(Number(e.target.value))}
                  className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2"
                >
                  {Array.from({ length: 7 }, (_, i) => huidigJaar + i).map(
                    (jaar) => (
                      <option key={jaar} value={jaar}>
                        {jaar}
                      </option>
                    )
                  )}
                </select>
              </label>

              <Link
                href="/admin/cashflow/dashboard"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Terug naar dashboard
              </Link>
            </div>
          </div>

          {data?.success && (
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Peildatum
                </div>
                <div className="mt-1 font-semibold text-slate-900">
                  {data.peildatum}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Startsaldo
                </div>
                <div className="mt-1 font-semibold text-slate-900">
                  {euro.format(data.startsaldo ?? 0)}
                </div>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Eindsaldo
                </div>
                <div className="mt-1 font-semibold text-slate-900">
                  {euro.format(data.eindsaldo ?? 0)}
                </div>
              </div>
            </div>
          )}

          <p className="mt-4 text-xs text-slate-500">
            De volgorde van regels binnen een maand is voor leesbaarheid; de
            prognose rekent op maandniveau en kent voor gewone maandposten geen
            exacte bankdatum.
          </p>
        </section>

        {loading && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
            Overzicht laden…
          </section>
        )}

        {!loading && data && !data.success && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 shadow-sm">
            {data.error || "Kasstroomoverzicht kon niet worden geladen."}
          </section>
        )}

        {!loading && data?.success && (
          <>
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Periode</th>
                      <th className="px-4 py-3">Omschrijving</th>
                      <th className="px-4 py-3 text-right">In</th>
                      <th className="px-4 py-3 text-right">Uit</th>
                      <th className="px-4 py-3 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {groepen.map(([key, regels]) => (
                      <>
                        {key !== "start" && (
                          <tr
                            key={`${key}-header`}
                            className="border-t border-slate-200 bg-slate-50/70"
                          >
                            <td
                              colSpan={5}
                              className="px-4 py-2 font-semibold text-slate-700"
                            >
                              {maanden[regels[0].maand]} {regels[0].jaar}
                            </td>
                          </tr>
                        )}
                        {regels.map((regel) => {
                          const speciaal =
                            regel.categorie === "btw" ||
                            regel.categorie === "vpb";
                          return (
                            <tr
                              key={`${key}-${regel.volgorde}`}
                              className={`border-t border-slate-100 ${
                                regel.categorie === "start"
                                  ? "bg-emerald-50/60 font-semibold"
                                  : speciaal
                                  ? "bg-amber-50/60"
                                  : ""
                              }`}
                            >
                              <td className="whitespace-nowrap px-4 py-2.5 text-slate-500">
                                {regel.datumLabel}
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="font-medium text-slate-800">
                                  {regel.omschrijving}
                                </div>
                                {regel.bron && (
                                  <div className="mt-0.5 text-xs text-slate-400">
                                    {regel.bron}
                                  </div>
                                )}
                              </td>
                              <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium text-emerald-700">
                                {bedrag(regel.in)}
                              </td>
                              <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium text-red-700">
                                {bedrag(regel.uit)}
                              </td>
                              <td className="whitespace-nowrap px-4 py-2.5 text-right font-semibold text-slate-900">
                                {euro.format(regel.saldo)}
                              </td>
                            </tr>
                          );
                        })}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section
              className={`rounded-2xl border p-4 text-sm shadow-sm ${
                data.controle4PA?.aansluitingOk
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              <div className="font-semibold">
                Controle aansluiting rekenmotor:{" "}
                {data.controle4PA?.aansluitingOk ? "OK" : "AFWIJKING"}
              </div>
              <div className="mt-1">
                Overzicht {euro.format(data.controle4PA?.eindsaldoOverzicht ?? 0)}
                {" · "}
                rekenmotor{" "}
                {data.controle4PA?.verwachtEindsaldo == null
                  ? "onbekend"
                  : euro.format(data.controle4PA.verwachtEindsaldo)}
                {" · "}
                verschil{" "}
                {data.controle4PA?.verschil == null
                  ? "onbekend"
                  : euro.format(data.controle4PA.verschil)}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
