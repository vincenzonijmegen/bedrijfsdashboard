"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx-js-style";

type Entiteit = "vincenzo" | "rekka" | "eetje-pans";

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

const entiteiten: Array<{
  key: Entiteit;
  label: string;
}> = [
  { key: "vincenzo", label: "IJssalon Vincenzo B.V." },
  { key: "rekka", label: "Rekka Holding B.V." },
  { key: "eetje-pans", label: "Eetje Pans Holding B.V." },
];

function bedrag(v: number) {
  return v === 0 ? "" : euro.format(v);
}

function endpointVoor(entiteit: Entiteit, totJaar: number) {
  return entiteit === "vincenzo"
    ? `/api/admin/cashflow/kasstroomoverzicht?tot=${totJaar}`
    : `/api/admin/cashflow/holding-overzicht?entiteit=${entiteit}&tot=${totJaar}`;
}

function controleVan(data: ApiData) {
  return (
    data.controle4TA ??
    data.controle4PB ??
    data.controle4PA ??
    data.controle
  );
}

const excelGeldFormaat = '€ #,##0.00;[Red]-€ #,##0.00;–';

function maakCashflowWerkblad(
  data: ApiData,
  entiteitKey: Entiteit,
  label: string
) {
  const regels = data.regels ?? [];
  const buffer =
    data.minimumKasbuffer == null
      ? entiteitKey === "vincenzo"
        ? 20000
        : null
      : Number(data.minimumKasbuffer);

  const rows: Array<Array<string | number | null>> = [
    [label],
    ["Cashflowprognose t/m", Number(data.totJaar ?? 0) || ""],
    [
      "Peildatum",
      data.peildatum ?? "—",
      "Startsaldo",
      Number(data.startsaldo ?? 0),
      "Eindsaldo rekenmotor",
      Number(data.eindsaldo ?? 0),
      "Minimumbuffer",
      buffer,
    ],
    [],
    [
      "Jaar",
      "Maand",
      "Periode",
      "Omschrijving",
      "Categorie",
      "Bron",
      "In",
      "Uit",
      "Saldo",
    ],
  ];

  for (const regel of regels) {
    rows.push([
      regel.jaar,
      regel.categorie === "start" ? "" : maanden[regel.maand] ?? regel.maand,
      regel.datumLabel,
      regel.omschrijving,
      regel.categorie,
      regel.bron ?? "",
      Number(regel.in ?? 0),
      Number(regel.uit ?? 0),
      Number(regel.saldo ?? 0),
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const eersteDataRij = 6;
  const laatsteDataRij = eersteDataRij + Math.max(regels.length - 1, 0);

  // Doorlopend saldo als echte Excel-formule. Daardoor kan Herm bedragen
  // in kolom In/Uit wijzigen en rekent het hele saldo direct opnieuw door.
  regels.forEach((regel, index) => {
    const excelRij = eersteDataRij + index;
    const cel = `I${excelRij}`;
    if (index === 0 || regel.categorie === "start") {
      ws[cel] = {
        t: "n",
        v: Number(regel.saldo ?? data.startsaldo ?? 0),
        z: excelGeldFormaat,
      } as any;
    } else {
      ws[cel] = {
        t: "n",
        f: `I${excelRij - 1}+G${excelRij}-H${excelRij}`,
        v: Number(regel.saldo ?? 0),
        z: excelGeldFormaat,
      } as any;
    }
  });

  const controleStart = laatsteDataRij + 3;
  XLSX.utils.sheet_add_aoa(
    ws,
    [
      ["Controle"],
      ["Eindsaldo volgens rekenmotor", Number(data.eindsaldo ?? 0)],
      ["Eindsaldo volgens Excel", null],
      ["Verschil Excel - rekenmotor", null],
    ],
    { origin: `A${controleStart}` }
  );

  const excelEindsaldoRij = controleStart + 2;
  const verschilRij = controleStart + 3;
  ws[`B${excelEindsaldoRij}`] = {
    t: "n",
    f: regels.length > 0 ? `I${laatsteDataRij}` : "0",
    v: Number(data.eindsaldo ?? 0),
    z: excelGeldFormaat,
  } as any;
  ws[`B${verschilRij}`] = {
    t: "n",
    f: `B${excelEindsaldoRij}-B${controleStart + 1}`,
    v: 0,
    z: excelGeldFormaat,
  } as any;

  // Opmaak titel en metadata.
  ws["!merges"] = [XLSX.utils.decode_range("A1:I1")];
  ws["A1"].s = {
    fill: { fgColor: { rgb: "047857" } },
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 16 },
    alignment: { vertical: "center" },
  };

  for (const addr of ["A2", "A3", "C3", "E3", "G3"]) {
    if (ws[addr]) {
      ws[addr].s = {
        font: { bold: true, color: { rgb: "475569" } },
      };
    }
  }

  for (const addr of ["D3", "F3", "H3"]) {
    if (ws[addr] && typeof ws[addr].v === "number") {
      ws[addr].z = excelGeldFormaat;
    }
  }

  for (let c = 0; c <= 8; c += 1) {
    const addr = XLSX.utils.encode_cell({ r: 4, c });
    if (ws[addr]) {
      ws[addr].s = {
        fill: { fgColor: { rgb: "0F172A" } },
        font: { bold: true, color: { rgb: "FFFFFF" } },
        alignment: { vertical: "center", horizontal: c >= 6 ? "right" : "left" },
        border: {
          bottom: { style: "thin", color: { rgb: "94A3B8" } },
        },
      };
    }
  }

  regels.forEach((regel, index) => {
    const r = 5 + index;
    const isStart = regel.categorie === "start";
    const isBelasting = ["btw", "vpb", "dividendbelasting"].includes(
      regel.categorie
    );

    for (let c = 0; c <= 8; c += 1) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];
      if (!cell) continue;

      cell.s = {
        fill: isStart
          ? { fgColor: { rgb: "D1FAE5" } }
          : isBelasting
            ? { fgColor: { rgb: "FEF3C7" } }
            : undefined,
        font: {
          bold: isStart || c === 8,
          color:
            c === 6
              ? { rgb: "047857" }
              : c === 7
                ? { rgb: "B91C1C" }
                : { rgb: "0F172A" },
        },
        alignment: {
          vertical: "top",
          horizontal: c >= 6 ? "right" : "left",
          wrapText: c === 3 || c === 5,
        },
        border: {
          bottom: { style: "hair", color: { rgb: "E2E8F0" } },
        },
      };

      if (c >= 6) cell.z = excelGeldFormaat;
    }
  });

  for (let r = controleStart; r <= verschilRij; r += 1) {
    for (let c = 0; c <= 1; c += 1) {
      const addr = XLSX.utils.encode_cell({ r: r - 1, c });
      if (!ws[addr]) continue;
      ws[addr].s = {
        fill:
          r === controleStart
            ? { fgColor: { rgb: "D1FAE5" } }
            : { fgColor: { rgb: "F8FAFC" } },
        font: { bold: true, color: { rgb: "0F172A" } },
      };
      if (c === 1 && r > controleStart) ws[addr].z = excelGeldFormaat;
    }
  }

  ws["!cols"] = [
    { wch: 8 },
    { wch: 12 },
    { wch: 18 },
    { wch: 44 },
    { wch: 24 },
    { wch: 26 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
  ];
  ws["!rows"] = [{ hpt: 24 }, { hpt: 18 }, { hpt: 20 }, { hpt: 8 }, { hpt: 22 }];
  ws["!freeze"] = { ySplit: 5 } as never;
  if (regels.length > 0) {
    ws["!autofilter"] = { ref: `A5:I${laatsteDataRij}` };
  }

  return {
    werkblad: ws,
    laatsteDataRij,
    controleVerschilRij: verschilRij,
  };
}

function maakSamenvatting(
  items: Array<{
    key: Entiteit;
    label: string;
    data: ApiData;
    sheetName: string;
    laatsteDataRij: number;
  }>,
  totJaar: number
) {
  const rows: Array<Array<string | number | null>> = [
    ["Cashflowprognose – samenvatting"],
    ["Tonen t/m", totJaar],
    [],
    [
      "Entiteit",
      "Peildatum",
      "Startsaldo",
      "Eindsaldo rekenmotor",
      "Eindsaldo Excel",
      "Verschil",
      "Minimumbuffer",
      "API-controle",
    ],
  ];

  for (const item of items) {
    const controle = controleVan(item.data);
    const buffer =
      item.data.minimumKasbuffer == null
        ? item.key === "vincenzo"
          ? 20000
          : null
        : Number(item.data.minimumKasbuffer);
    rows.push([
      item.label,
      item.data.peildatum ?? "—",
      Number(item.data.startsaldo ?? 0),
      Number(item.data.eindsaldo ?? 0),
      null,
      null,
      buffer,
      controle?.aansluitingOk ? "OK" : "AFWIJKING",
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!merges"] = [XLSX.utils.decode_range("A1:H1")];
  ws["A1"].s = {
    fill: { fgColor: { rgb: "047857" } },
    font: { bold: true, color: { rgb: "FFFFFF" }, sz: 16 },
  };

  for (let c = 0; c <= 7; c += 1) {
    const addr = XLSX.utils.encode_cell({ r: 3, c });
    if (ws[addr]) {
      ws[addr].s = {
        fill: { fgColor: { rgb: "0F172A" } },
        font: { bold: true, color: { rgb: "FFFFFF" } },
        alignment: { horizontal: c >= 2 && c <= 6 ? "right" : "left" },
      };
    }
  }

  items.forEach((item, index) => {
    const excelRij = 5 + index;
    ws[`E${excelRij}`] = {
      t: "n",
      f: `'${item.sheetName.replaceAll("'", "''")}'!I${item.laatsteDataRij}`,
      v: Number(item.data.eindsaldo ?? 0),
      z: excelGeldFormaat,
    } as any;
    ws[`F${excelRij}`] = {
      t: "n",
      f: `E${excelRij}-D${excelRij}`,
      v: 0,
      z: excelGeldFormaat,
    } as any;

    for (const c of [2, 3, 4, 5, 6]) {
      const addr = XLSX.utils.encode_cell({ r: excelRij - 1, c });
      if (ws[addr]) ws[addr].z = excelGeldFormaat;
    }
  });

  ws["!cols"] = [
    { wch: 30 },
    { wch: 14 },
    { wch: 17 },
    { wch: 20 },
    { wch: 17 },
    { wch: 14 },
    { wch: 17 },
    { wch: 14 },
  ];
  ws["!freeze"] = { ySplit: 4 } as never;
  if (items.length > 0) ws["!autofilter"] = { ref: `A4:H${4 + items.length}` };
  return ws;
}

export default function CashflowOverzichtPage() {
  const huidigJaar = new Date().getFullYear();
  const [totJaar, setTotJaar] = useState(huidigJaar + 1);
  const [entiteit, setEntiteit] = useState<Entiteit>("vincenzo");
  const [data, setData] = useState<ApiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [excelBezig, setExcelBezig] = useState(false);

  useEffect(() => {
    let actief = true;

    async function laad() {
      setLoading(true);
      try {
        const res = await fetch(endpointVoor(entiteit, totJaar), { cache: "no-store" });
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
  }, [entiteit, totJaar]);

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

  const controle = data ? controleVan(data) : undefined;

  async function laadEntiteitVoorExcel(key: Entiteit) {
    if (key === entiteit && data?.success) return data;

    const res = await fetch(endpointVoor(key, totJaar), { cache: "no-store" });
    const json = (await res.json()) as ApiData;
    if (!res.ok || !json.success) {
      throw new Error(
        json.error ?? `Cashflow voor ${key} kon niet worden geladen`
      );
    }
    return json;
  }

  async function exporteerExcel(mode: "deze" | "alle") {
    if (excelBezig) return;
    setExcelBezig(true);

    try {
      const selectie =
        mode === "alle"
          ? entiteiten
          : entiteiten.filter((item) => item.key === entiteit);

      const geladen = await Promise.all(
        selectie.map(async (item) => ({
          ...item,
          data: await laadEntiteitVoorExcel(item.key),
        }))
      );

      const sheetNamen: Record<Entiteit, string> = {
        vincenzo: "Vincenzo",
        rekka: "Rekka",
        "eetje-pans": "Eetje Pans",
      };

      const werkbladen = geladen.map((item) => {
        const sheetName = sheetNamen[item.key];
        const gemaakt = maakCashflowWerkblad(
          item.data,
          item.key,
          item.data.entiteitNaam ?? item.label
        );
        return { ...item, sheetName, ...gemaakt };
      });

      const wb = XLSX.utils.book_new();
      (wb as any).Workbook = {
        ...((wb as any).Workbook ?? {}),
        CalcPr: { calcMode: "auto", fullCalcOnLoad: true, forceFullCalc: true },
      };
      XLSX.utils.book_append_sheet(
        wb,
        maakSamenvatting(
          werkbladen.map((item) => ({
            key: item.key,
            label: item.data.entiteitNaam ?? item.label,
            data: item.data,
            sheetName: item.sheetName,
            laatsteDataRij: item.laatsteDataRij,
          })),
          totJaar
        ),
        "Samenvatting"
      );

      for (const item of werkbladen) {
        XLSX.utils.book_append_sheet(wb, item.werkblad, item.sheetName);
      }

      const naam =
        mode === "alle"
          ? `cashflow-alle-entiteiten-tm-${totJaar}.xlsx`
          : `cashflow-${entiteit}-tm-${totJaar}.xlsx`;

      XLSX.writeFile(wb, naam, { compression: true });
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : "Excel-export kon niet worden gemaakt"
      );
    } finally {
      setExcelBezig(false);
    }
  }

  const entiteitLabel =
    data?.entiteitNaam ??
    entiteiten.find((item) => item.key === entiteit)?.label ??
    "";

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600">
                {entiteitLabel}
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
                Entiteit
                <select
                  value={entiteit}
                  onChange={(e) => setEntiteit(e.target.value as Entiteit)}
                  className="ml-2 rounded-lg border border-slate-300 bg-white px-3 py-2"
                >
                  {entiteiten.map((item) => (
                    <option key={item.key} value={item.key}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

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
                href={`/admin/cashflow/overzicht/print?entiteit=${entiteit}&tot=${totJaar}`}
                target="_blank"
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-100"
              >
                Print/PDF deze entiteit
              </Link>

              <Link
                href={`/admin/cashflow/overzicht/print?entiteit=alle&tot=${totJaar}`}
                target="_blank"
                className="rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-800 hover:bg-emerald-50"
              >
                Print/PDF alle 3
              </Link>

              <button
                type="button"
                onClick={() => void exporteerExcel("deze")}
                disabled={loading || excelBezig || !data?.success}
                className="rounded-lg border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {excelBezig ? "Excel maken…" : "Excel deze entiteit"}
              </button>

              <button
                type="button"
                onClick={() => void exporteerExcel("alle")}
                disabled={loading || excelBezig}
                className="rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm font-medium text-blue-800 hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {excelBezig ? "Excel maken…" : "Excel alle 3"}
              </button>


              <Link
                href="/admin/cashflow/dashboard"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Terug naar dashboard
              </Link>
            </div>
          </div>

          {data?.success && (
            <div className="mt-4 grid gap-3 sm:grid-cols-4">
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
              <div className="rounded-xl bg-slate-50 p-3">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Minimumbuffer
                </div>
                <div className="mt-1 font-semibold text-slate-900">
                  {data.minimumKasbuffer == null
                    ? entiteit === "vincenzo"
                      ? euro.format(20000)
                      : "—"
                    : euro.format(data.minimumKasbuffer)}
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
                      <Fragment key={key}>
                        {key !== "start" && (
                          <tr className="border-t border-slate-200 bg-slate-50/70">
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
                            regel.categorie === "vpb" ||
                            regel.categorie === "dividendbelasting";

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
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section
              className={`rounded-2xl border p-4 text-sm shadow-sm ${
                controle?.aansluitingOk
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              <div className="font-semibold">
                Controle aansluiting rekenmotor:{" "}
                {controle?.aansluitingOk ? "OK" : "AFWIJKING"}
              </div>
              <div className="mt-1">
                Overzicht {euro.format(controle?.eindsaldoOverzicht ?? 0)}
                {" · "}
                rekenmotor{" "}
                {controle?.verwachtEindsaldo == null
                  ? "onbekend"
                  : euro.format(controle.verwachtEindsaldo)}
                {" · "}
                verschil{" "}
                {controle?.verschil == null
                  ? "onbekend"
                  : euro.format(controle.verschil)}
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
