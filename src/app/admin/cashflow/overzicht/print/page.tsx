"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";

type Entiteit = "vincenzo" | "rekka" | "eetje-pans";
type PrintMode = Entiteit | "alle";

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

type Controle = {
  verwachtEindsaldo: number | null;
  eindsaldoOverzicht: number;
  verschil: number | null;
  aansluitingOk: boolean;
  aantalRegels: number;
  btwRegels: number;
};

type ApiData = {
  success: boolean;
  fase?: string;
  error?: string;
  entiteitNaam?: string;
  peildatum?: string;
  totJaar?: number;
  startsaldo?: number;
  eindsaldo?: number;
  minimumKasbuffer?: number | null;
  regels?: Regel[];
  controle?: Controle;
  controle4PA?: Controle;
  controle4PB?: Controle;
  controle4TA?: Controle;
};

type LoadedEntity = {
  key: Entiteit;
  label: string;
  data: ApiData;
};

const euro = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

const datumTijd = new Intl.DateTimeFormat("nl-NL", {
  dateStyle: "short",
  timeStyle: "short",
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

const entiteiten: Array<{ key: Entiteit; label: string }> = [
  { key: "vincenzo", label: "IJssalon Vincenzo B.V." },
  { key: "rekka", label: "Rekka Holding B.V." },
  { key: "eetje-pans", label: "Eetje Pans Holding B.V." },
];

function bedrag(v: number) {
  return v === 0 ? "" : euro.format(v);
}

function controleVan(data: ApiData) {
  return (
    data.controle4TA ??
    data.controle4PB ??
    data.controle4PA ??
    data.controle
  );
}

function groepenVan(data: ApiData) {
  const map = new Map<string, Regel[]>();
  for (const regel of data.regels ?? []) {
    const key =
      regel.categorie === "start"
        ? "start"
        : `${regel.jaar}-${String(regel.maand).padStart(2, "0")}`;
    const huidig = map.get(key) ?? [];
    huidig.push(regel);
    map.set(key, huidig);
  }
  return [...map.entries()];
}

function endpointVoor(entiteit: Entiteit, totJaar: number) {
  return entiteit === "vincenzo"
    ? `/api/admin/cashflow/kasstroomoverzicht?tot=${totJaar}`
    : `/api/admin/cashflow/holding-overzicht?entiteit=${entiteit}&tot=${totJaar}`;
}

function PrintSectie({
  item,
  index,
}: {
  item: LoadedEntity;
  index: number;
}) {
  const { data } = item;
  const groepen = useMemo(() => groepenVan(data), [data]);
  const controle = controleVan(data);
  const label = data.entiteitNaam ?? item.label;

  if (!data.success) {
    return (
      <section
        className={`${index > 0 ? "print-entity-break" : ""} rounded-xl border border-red-300 bg-red-50 p-5 text-red-800`}
      >
        <h2 className="text-xl font-bold">{label}</h2>
        <p className="mt-2 text-sm">
          {data.error ?? "Overzicht kon niet worden geladen."}
        </p>
      </section>
    );
  }

  return (
    <section className={index > 0 ? "print-entity-break" : ""}>
      <header className="mb-4 border-b-2 border-slate-800 pb-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Cashflowprognose
        </p>
        <h2 className="mt-1 text-2xl font-bold text-slate-950">{label}</h2>
        <p className="mt-1 text-sm text-slate-600">
          Overzicht t/m {data.totJaar ?? "—"}
        </p>
      </header>

      <div className="mb-4 grid grid-cols-4 gap-2 text-sm">
        <div className="rounded border border-slate-300 p-2">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">
            Peildatum
          </div>
          <div className="mt-1 font-semibold">{data.peildatum ?? "—"}</div>
        </div>
        <div className="rounded border border-slate-300 p-2">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">
            Startsaldo
          </div>
          <div className="mt-1 font-semibold">
            {euro.format(data.startsaldo ?? 0)}
          </div>
        </div>
        <div className="rounded border border-slate-300 p-2">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">
            Eindsaldo
          </div>
          <div className="mt-1 font-semibold">
            {euro.format(data.eindsaldo ?? 0)}
          </div>
        </div>
        <div className="rounded border border-slate-300 p-2">
          <div className="text-[10px] uppercase tracking-wide text-slate-500">
            Minimumbuffer
          </div>
          <div className="mt-1 font-semibold">
            {data.minimumKasbuffer == null
              ? item.key === "vincenzo"
                ? euro.format(20000)
                : "—"
              : euro.format(data.minimumKasbuffer)}
          </div>
        </div>
      </div>

      <table className="w-full border-collapse text-[11px] leading-tight">
        <thead>
          <tr className="border-y border-slate-400 bg-slate-100 text-left text-[10px] uppercase tracking-wide text-slate-600">
            <th className="w-[16%] px-2 py-2">Periode</th>
            <th className="w-[42%] px-2 py-2">Omschrijving</th>
            <th className="w-[14%] px-2 py-2 text-right">In</th>
            <th className="w-[14%] px-2 py-2 text-right">Uit</th>
            <th className="w-[14%] px-2 py-2 text-right">Saldo</th>
          </tr>
        </thead>
        <tbody>
          {groepen.map(([key, regels]) => (
            <Fragment key={key}>
              {key !== "start" && (
                <tr className="month-header border-t border-slate-400 bg-slate-100">
                  <td colSpan={5} className="px-2 py-1.5 font-bold text-slate-800">
                    {maanden[regels[0].maand]} {regels[0].jaar}
                  </td>
                </tr>
              )}

              {regels.map((regel) => {
                const speciaal =
                  regel.categorie === "btw" ||
                  regel.categorie === "vpb" ||
                  regel.categorie === "dividendbelasting";

                return (
                  <tr
                    key={`${key}-${regel.volgorde}`}
                    className={`print-row border-t border-slate-200 ${
                      regel.categorie === "start"
                        ? "bg-emerald-50 font-semibold"
                        : speciaal
                          ? "bg-amber-50"
                          : ""
                    }`}
                  >
                    <td className="whitespace-nowrap px-2 py-1.5 text-slate-600">
                      {regel.datumLabel}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="font-medium text-slate-900">
                        {regel.omschrijving}
                      </div>
                      {regel.bron && (
                        <div className="mt-0.5 text-[9px] text-slate-500">
                          {regel.bron}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right font-medium">
                      {bedrag(regel.in)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right font-medium">
                      {bedrag(regel.uit)}
                    </td>
                    <td className="whitespace-nowrap px-2 py-1.5 text-right font-semibold">
                      {euro.format(regel.saldo)}
                    </td>
                  </tr>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>

      <div
        className={`mt-4 rounded border p-3 text-xs ${
          controle?.aansluitingOk
            ? "border-emerald-400 bg-emerald-50 text-emerald-900"
            : "border-red-400 bg-red-50 text-red-900"
        }`}
      >
        <div className="font-semibold">
          Controle aansluiting rekenmotor: {controle?.aansluitingOk ? "OK" : "AFWIJKING"}
        </div>
        <div className="mt-1">
          Overzicht {euro.format(controle?.eindsaldoOverzicht ?? 0)} · rekenmotor{" "}
          {controle?.verwachtEindsaldo == null
            ? "onbekend"
            : euro.format(controle.verwachtEindsaldo)}{" "}
          · verschil{" "}
          {controle?.verschil == null
            ? "onbekend"
            : euro.format(controle.verschil)}
        </div>
      </div>
    </section>
  );
}

export default function CashflowPrintPage() {
  const huidigJaar = new Date().getFullYear();
  const [mode, setMode] = useState<PrintMode>("vincenzo");
  const [totJaar, setTotJaar] = useState(huidigJaar + 1);
  const [paramsKlaar, setParamsKlaar] = useState(false);
  const [items, setItems] = useState<LoadedEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [gegenereerdOp, setGegenereerdOp] = useState<Date | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const rawEntiteit = params.get("entiteit") ?? "vincenzo";
    const rawTot = Number(params.get("tot") ?? huidigJaar + 1);

    const geldigeMode: PrintMode = [
      "vincenzo",
      "rekka",
      "eetje-pans",
      "alle",
    ].includes(rawEntiteit)
      ? (rawEntiteit as PrintMode)
      : "vincenzo";

    setMode(geldigeMode);
    setTotJaar(
      Number.isInteger(rawTot) && rawTot >= huidigJaar && rawTot <= huidigJaar + 10
        ? rawTot
        : huidigJaar + 1
    );
    setParamsKlaar(true);
  }, [huidigJaar]);

  useEffect(() => {
    if (!paramsKlaar) return;

    let actief = true;

    async function laad() {
      setLoading(true);
      try {
        const selectie =
          mode === "alle"
            ? entiteiten
            : entiteiten.filter((item) => item.key === mode);

        const geladen = await Promise.all(
          selectie.map(async (item) => {
            try {
              const res = await fetch(endpointVoor(item.key, totJaar), {
                cache: "no-store",
              });
              const data = (await res.json()) as ApiData;
              return { ...item, data };
            } catch (error) {
              return {
                ...item,
                data: {
                  success: false,
                  error:
                    error instanceof Error
                      ? error.message
                      : "Overzicht laden mislukt",
                },
              };
            }
          })
        );

        if (actief) {
          setItems(geladen);
          setGegenereerdOp(new Date());
        }
      } finally {
        if (actief) setLoading(false);
      }
    }

    void laad();
    return () => {
      actief = false;
    };
  }, [mode, paramsKlaar, totJaar]);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-5 text-slate-950 print:bg-white print:p-0">
      <style jsx global>{`
        @page {
          size: A4 landscape;
          margin: 11mm;
        }
        @media print {
          html,
          body {
            background: #ffffff !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .print-hidden {
            display: none !important;
          }
          .print-entity-break {
            break-before: page;
            page-break-before: always;
          }
          thead {
            display: table-header-group;
          }
          .print-row {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .month-header {
            break-after: avoid;
            page-break-after: avoid;
          }
        }
      `}</style>

      <div className="print-hidden mx-auto mb-5 flex max-w-[1200px] flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <h1 className="text-lg font-bold">Print/PDF cashflowoverzicht</h1>
          <p className="mt-1 text-sm text-slate-500">
            Kies in het afdrukvenster eventueel “Opslaan als PDF”.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            disabled={loading || items.length === 0}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Afdrukken / opslaan als PDF
          </button>
          <Link
            href="/admin/cashflow/overzicht"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Terug naar overzicht
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-[1200px] bg-white p-4 print:max-w-none print:p-0">
        <div className="mb-4 flex items-end justify-between border-b border-slate-300 pb-2 text-xs text-slate-500">
          <div>Vincenzo cashflowprognose</div>
          <div>
            Gegenereerd: {gegenereerdOp ? datumTijd.format(gegenereerdOp) : "—"}
          </div>
        </div>

        {loading && (
          <div className="rounded border border-slate-300 p-5 text-sm text-slate-500">
            Printoverzicht laden…
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="rounded border border-red-300 bg-red-50 p-5 text-sm text-red-800">
            Geen gegevens beschikbaar.
          </div>
        )}

        {!loading &&
          items.map((item, index) => (
            <PrintSectie key={item.key} item={item} index={index} />
          ))}
      </div>
    </main>
  );
}
