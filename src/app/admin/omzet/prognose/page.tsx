// src/app/admin/omzet/prognose/page.tsx
"use client";

import React, { useEffect, useState } from "react";

const maandNamen = ["maart", "april", "mei", "juni", "juli", "augustus", "september"];

interface MaandData {
  maand: number;
  prognoseOmzet: number;
  prognoseDagen: number;
  prognosePerDag: number;
  realisatieOmzet: number;
  realisatieDagen: number;
  realisatiePerDag: number | null;
  todoOmzet: number;
  todoDagen: number;
  todoPerDag: number | null;
  prognoseHuidig: number;
  plusmin: number;
  cumulatiefPlus: number;
  cumulatiefPrognose: number;
  cumulatiefRealisatie: number;
  voorAchterInDagen: number | null;
  procentueel: number | null;
  jrPrognoseObvTotNu: number;
}

interface LoonkostenItem {
  jaar: number;
  maand: number;
  lonen: number;
  loonheffing: number;
  pensioenpremie: number;
}

export default function PrognosePage() {
  const [data, setData] = useState<MaandData[]>([]);
  const [jaar, setJaar] = useState<number>(new Date().getFullYear());
  const [jaaromzet, setJaaromzet] = useState<number>(0);
  const [vorigJaarOmzet, setVorigJaarOmzet] = useState<number>(0);
  const [loonkosten, setLoonkosten] = useState<LoonkostenItem[]>([]);

  // helpers
  const asArray = <T,>(v: any): T[] => (Array.isArray(v) ? (v as T[]) : []);
  const safeFindLoon = (maand: number) =>
    Array.isArray(loonkosten)
      ? loonkosten.find((l) => Number(l.maand) === Number(maand))
      : undefined;

  // 1) haal prognose/analyse op (en bepaal jaar)
  useEffect(() => {
    fetch("/api/prognose/analyse")
      .then((res) => res.json())
      .then((res) => {
        setData(asArray<MaandData>(res?.resultaten));
        setJaaromzet(Number(res?.jaaromzet ?? 0));
        if (typeof res?.vorigJaarOmzet === "number") setVorigJaarOmzet(res.vorigJaarOmzet);
        // Als de analyse een jaar meegeeft, gebruik die — anders blijft default (huidig jaar)
        if (typeof res?.jaar === "number" && res.jaar > 0) setJaar(res.jaar);
      })
      .catch(() => {
        setData([]);
        setJaaromzet(0);
        setVorigJaarOmzet(0);
      });
  }, []);

  // 2) haal loonkosten op voor het gekozen jaar
  useEffect(() => {
    if (!jaar) return;
    fetch(`/api/rapportage/loonkosten?jaar=${encodeURIComponent(jaar)}`)
      .then((res) => res.json())
      .then((res) => setLoonkosten(asArray<LoonkostenItem>(res)))
      .catch(() => setLoonkosten([]));
  }, [jaar]);

  const getLoonkosten = (maand: number) => {
    const item = safeFindLoon(maand);
    if (!item) return 0;
    return Number(item.lonen) + Number(item.loonheffing) + Number(item.pensioenpremie);
  };

  const getLoonkostenPercentage = (maand: number, omzet: number) => {
    const totaal = getLoonkosten(maand);
    return omzet > 0 ? (totaal / omzet) * 100 : 0;
    };

  const totalRealisatieOmzet = data.reduce((sum, m) => sum + (Number(m.realisatieOmzet) || 0), 0);
  const totalRealisatieDagen = data.reduce((sum, m) => sum + (Number(m.realisatieDagen) || 0), 0);
  const totalPrognoseDagen = data.reduce((sum, m) => sum + (Number(m.prognoseDagen) || 0), 0);
  const omzetPercent = jaaromzet > 0 ? Math.round((totalRealisatieOmzet / jaaromzet) * 100) : 0;
  const dagenPercent = totalPrognoseDagen > 0 ? Math.round((totalRealisatieDagen / totalPrognoseDagen) * 100) : 0;

  const isHeaderLabel = (label: string) =>
    ["PROGNOSE", "REALISATIE", "TO-DO", "PROGNOSES", "LONEN"].includes(label.toUpperCase());

  const rows: [string, (m: MaandData) => number | null][] = [
    ["PROGNOSE", () => null],
    ["omzet", (m) => m.prognoseOmzet],
    ["dagen", (m) => m.prognoseDagen],
    ["omzet/dag", (m) => m.prognosePerDag],
    ["REALISATIE", () => null],
    ["omzet", (m) => m.realisatieOmzet],
    ["dagen", (m) => m.realisatieDagen],
    ["omzet/dag", (m) => m.realisatiePerDag ?? null],
    ["voor/achter in dagen", (m) => m.voorAchterInDagen],
    ["TO-DO", () => null],
    ["omzet", (m) => m.todoOmzet],
    ["dagen", (m) => m.todoDagen],
    ["omzet/dag", (m) => m.todoPerDag ?? null],
    ["PROGNOSES", () => null],
    ["prognose obv huidig", (m) => m.prognoseHuidig],
    ["prognose plusmin", (m) => m.plusmin],
    ["prognose obv omzet to date", (m) => m.jrPrognoseObvTotNu],
    ["LONEN", () => null],
    ["Loonkosten", (m) => Number(getLoonkosten(m.maand))],
    ["% van omzet", (m) => getLoonkostenPercentage(m.maand, m.realisatieOmzet)],
  ];

  return (
    <main className="p-6">
      <a href="/admin/rapportage/financieel" className="text-sm underline text-blue-600 block mb-4">
        ← Financiële Rapportages
      </a>
      <h1 className="text-2xl font-bold mb-1">Omzetprognose overzicht</h1>
      <p className="text-xs text-gray-500 mb-6">Jaar: {jaar}</p>

      <p className="mb-4 text-gray-600">
        Prognose jaaromzet:&nbsp;
        <strong>€ {jaaromzet.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}</strong>
        {vorigJaarOmzet > 0 && (
          <span className="text-gray-500">
            {" "}
            (Omzet vorig jaar: € {vorigJaarOmzet.toLocaleString("nl-NL", { maximumFractionDigits: 0 })})
          </span>
        )}
      </p>

      <div className="overflow-auto">
        <table className="table-auto border border-collapse w-full text-sm">
          <tbody>
            {rows.map(([label, fn], rowIdx) => (
              <tr key={label} className={isHeaderLabel(label) ? "bg-gray-200" : "border-t"}>
                <td
                  className={`px-2 py-1 text-left whitespace-nowrap ${
                    isHeaderLabel(label) ? "font-bold" : "font-medium"
                  }`}
                >
                  {label}
                </td>

                {data.map((m) => {
                  const raw = fn(m);
                  let display = "";

                  if (isHeaderLabel(label)) {
                    const idx = Math.max(0, Math.min(maandNamen.length - 1, m.maand - 3));
                    display = maandNamen[idx] ?? "";
                  } else if (raw === null || raw === 0) {
                    display = "";
                  } else if (label === "dagen") {
                    display = Math.round(Number(raw)).toLocaleString("nl-NL");
                  } else if (label === "voor/achter in dagen") {
                    display = Number(raw).toLocaleString("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                  } else if (label === "% van omzet") {
                    display = `${Number(raw).toFixed(1)}%`;
                  } else {
                    display = Number(raw).toLocaleString("nl-NL", { maximumFractionDigits: 0 });
                  }

                  let cellClass = "px-2 py-1 text-right font-mono border";
                  if (isHeaderLabel(label)) cellClass = "px-2 py-1 text-right font-bold border";
                  if (label === "omzet/dag" && rowIdx === 7 && raw !== null)
                    cellClass += Number(raw) > (Number(m.prognosePerDag) || 0) ? " bg-green-100" : " bg-red-100";
                  if (label === "prognose plusmin" && raw !== null)
                    cellClass += Number(raw) > 0 ? " bg-green-100" : " bg-red-100";
                  if (label === "% van omzet" && raw !== null && Number(raw) > 25)
                    cellClass += " bg-red-100";

                  if (label === "Loonkosten") {
                    const item = safeFindLoon(m.maand);
                    const incompleet =
                      !!item &&
                      (Number(item.lonen) === 0 ||
                        Number(item.loonheffing) === 0 ||
                        Number(item.pensioenpremie) === 0);
                    if (incompleet) display += " 🔴";
                  }

                  return (
                    <td key={m.maand + label} className={cellClass}>
                      {display}
                    </td>
                  );
                })}

                <td className="px-2 py-1 text-right font-bold border">
                  {label === "omzet"
                    ? "€ " +
                      data.reduce((sum, m) => sum + (Number(fn(m) ?? 0) || 0), 0).toLocaleString("nl-NL", {
                        maximumFractionDigits: 0,
                      })
                    : label === "dagen"
                    ? data.reduce((sum, m) => sum + (Number(fn(m) ?? 0) || 0), 0).toLocaleString("nl-NL")
                    : label === "omzet/dag"
                    ? (() => {
                        let totOm = 0;
                        let totDg = 0;
                        if (rowIdx <= 3) {
                          totOm = data.reduce((s, m) => s + Number(m.prognoseOmzet || 0), 0);
                          totDg = data.reduce((s, m) => s + Number(m.prognoseDagen || 0), 0);
                        } else if (rowIdx <= 7) {
                          totOm = data.reduce((s, m) => s + Number(m.realisatieOmzet || 0), 0);
                          totDg = data.reduce((s, m) => s + Number(m.realisatieDagen || 0), 0);
                        } else if (rowIdx <= 12) {
                          totOm = data.reduce((s, m) => s + Number(m.todoOmzet || 0), 0);
                          totDg = data.reduce((s, m) => s + Number(m.todoDagen || 0), 0);
                        } else return "";
                        return totDg > 0 ? Math.round(totOm / totDg).toLocaleString("nl-NL") : "";
                      })()
                    : label === "Loonkosten"
                    ? "€ " +
                      data.reduce((sum, m) => sum + Number(getLoonkosten(m.maand)), 0).toLocaleString("nl-NL", {
                        maximumFractionDigits: 0,
                      })
                    : label === "% van omzet"
                    ? (() => {
                        const totaalLoon = data.reduce((s, m) => s + getLoonkosten(m.maand), 0);
                        const totaalOmzet = data.reduce((s, m) => s + Number(m.realisatieOmzet || 0), 0);
                        return totaalOmzet > 0 ? (totaalLoon / totaalOmzet * 100).toFixed(1) + "%" : "";
                      })()
                    : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 text-sm">
        <p>
          Gedaan <strong>{omzetPercent}%</strong> van de omzet in <strong>{dagenPercent}%</strong> van de dagen
        </p>
      </div>
    </main>
  );
}
