// src/app/admin/omzet/prognose/page.tsx
"use client";

import React, { useEffect, useState } from "react";

const maandNamen = [
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
];

interface MaandData {
  maand: number;                 // 1..12 (bij jullie 3..9)
  prognoseOmzet: number;         // geplande omzet voor de hele maand
  prognoseDagen: number;         // geplande dagen in de maand
  prognosePerDag: number;        // geplande omzet per dag
  realisatieOmzet: number;       // realisatie t/m vandaag (als maand lopend is), of totale realisatie (als maand voltooid is)
  realisatieDagen: number;       // gerealiseerde dagen t/m vandaag
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
  jrPrognoseObvTotNu: number;    // niet gebruikt in rendering hieronder
}

interface LoonkostenItem {
  jaar: number;
  maand: number; // 3..9
  lonen: number;
  loonheffing: number;
  pensioenpremie: number;
}

const thisYear = new Date().getFullYear();
const years = Array.from({ length: 6 }, (_, i) => thisYear - i); // bijv. 2025..2020

export default function PrognosePage() {
  const [selectedYear, setSelectedYear] = useState<number>(thisYear);

  const [data, setData] = useState<MaandData[]>([]);
  const [jaaromzet, setJaaromzet] = useState<number>(0);
  const [vorigJaarOmzet, setVorigJaarOmzet] = useState<number>(0);
  const [loonkosten, setLoonkosten] = useState<LoonkostenItem[]>([]);

  useEffect(() => {
    // Analyse voor gekozen jaar
    fetch(`/api/prognose/analyse?jaar=${selectedYear}`)
      .then((res) => res.json())
      .then((res) => {
        setData(res.resultaten ?? []);
        setJaaromzet(Number(res.jaaromzet ?? 0));
        if (typeof res.vorigJaarOmzet === "number") {
          setVorigJaarOmzet(res.vorigJaarOmzet);
        } else {
          setVorigJaarOmzet(0);
        }
      });

    // Loonkosten voor gekozen jaar (normaliseer response naar array)
    fetch(`/api/rapportage/loonkosten?jaar=${selectedYear}`)
      .then((res) => res.json())
      .then((res) => {
        const src = Array.isArray(res?.maanden)
          ? res.maanden
          : Array.isArray(res)
          ? res
          : Array.isArray(res?.data)
          ? res.data
          : [];

        const clean = (src as any[]).map((x) => ({
          jaar: Number(x.jaar ?? selectedYear),
          maand: Number(x.maand ?? 0),
          lonen: Number(x.lonen ?? 0),
          loonheffing: Number(x.loonheffing ?? 0),
          pensioenpremie: Number(x.pensioenpremie ?? 0),
        }));

        setLoonkosten(clean);
      })
      .catch(() => setLoonkosten([]));
  }, [selectedYear]);

  const getLoonkosten = (maand: number) => {
    const item = (Array.isArray(loonkosten) ? loonkosten : []).find(
      (l) => Number(l.maand) === Number(maand)
    );
    if (!item) return 0;
    return (
      Number(item.lonen) +
      Number(item.loonheffing) +
      Number(item.pensioenpremie)
    );
  };

  const getLoonkostenPercentage = (maand: number, omzet: number) => {
    const totaal = getLoonkosten(maand);
    return omzet > 0 ? (totaal / omzet) * 100 : 0;
  };

  const totalRealisatieOmzet = data.reduce((sum, m) => sum + m.realisatieOmzet, 0);
  const totalRealisatieDagen = data.reduce((sum, m) => sum + m.realisatieDagen, 0);
  const totalPrognoseDagen = data.reduce((sum, m) => sum + m.prognoseDagen, 0);
  const omzetPercent = jaaromzet > 0 ? Math.round((totalRealisatieOmzet / jaaromzet) * 100) : 0;
  const dagenPercent = totalPrognoseDagen > 0 ? Math.round((totalRealisatieDagen / totalPrognoseDagen) * 100) : 0;

  const isHeaderLabel = (label: string) =>
    ["PROGNOSE", "REALISATIE", "TO-DO", "PROGNOSES", "LONEN"].includes(label.toUpperCase());

  // =========================
  // PROGNOSE O.B.V. OMZET TO DATE (per maandkolom)
  // =========================
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1..12

  // Snelhelpers
  const sumRealisatieTmt = (maand: number) =>
    data.filter(x => x.maand <= maand).reduce((s, x) => s + (x.realisatieOmzet ?? 0), 0);

  const sumPrognoseNa = (maand: number) =>
    data.filter(x => x.maand > maand).reduce((s, x) => s + (x.prognoseOmzet ?? 0), 0);

  const projTodayForCurrentMonth = (() => {
    if (selectedYear !== currentYear) {
      // Voor niet-huidige jaren geen "to date"-projectie
      return null;
    }
    const cur = data.find(x => x.maand === currentMonth);
    const realizedUntilPrev = sumRealisatieTmt(currentMonth - 1);
    const realizedToDateThisMonth = cur?.realisatieOmzet ?? 0;
    const remainingDays = Math.max(0, (cur?.prognoseDagen ?? 0) - (cur?.realisatieDagen ?? 0));
    const perDag = cur?.prognosePerDag ?? 0;
    const restOfThisMonth = remainingDays * perDag;
    const restOfYearAfterThisMonth = sumPrognoseNa(currentMonth);
    return realizedUntilPrev + realizedToDateThisMonth + restOfThisMonth + restOfYearAfterThisMonth;
  })();

  // Let op: map met number | null, zodat we lege cellen kunnen tonen
  const prognoseObvToDateByMonth = new Map<number, number | null>();
  for (const m of data) {
    let val: number | null = 0;

    if (selectedYear < currentYear) {
      // Verleden jaar → per kolom as-of einde van die maand
      val = sumRealisatieTmt(m.maand) + sumPrognoseNa(m.maand);
    } else if (selectedYear > currentYear) {
      // Toekomstig jaar → leeg laten
      val = null;
    } else {
      // Huidig jaar
      if (m.maand < currentMonth) {
        // Voltooide maand: realisatie t/m die maand + geplande rest
        val = sumRealisatieTmt(m.maand) + sumPrognoseNa(m.maand);
      } else if (m.maand === currentMonth) {
        // Lopende maand: realisatie to_date + (prognosePerDag × resterende dagen) + geplande rest van het jaar
        val = projTodayForCurrentMonth ?? null;
      } else {
        // Toekomstige maanden in huidig jaar → leeg
        val = null;
      }
    }

    prognoseObvToDateByMonth.set(m.maand, val);
  }

  const rows: [string, (m: MaandData) => number | null][] = [
    ["PROGNOSE", () => null],
    ["omzet", (m) => m.prognoseOmzet],
    ["dagen", (m) => m.prognoseDagen],
    ["omzet/dag", (m) => m.prognosePerDag],
    ["REALISATIE", () => null],
    ["omzet", (m) => m.realisatieOmzet],
    ["dagen", (m) => m.realisatieDagen],
    ["omzet/dag", (m) => m.realisatiePerDag],
    ["voor/achter in dagen", (m) => m.voorAchterInDagen],
    ["TO-DO", () => null],
    ["omzet", (m) => m.todoOmzet],
    ["dagen", (m) => m.todoDagen],
    ["omzet/dag", (m) => m.todoPerDag],
    ["PROGNOSES", () => null],
    ["prognose obv huidig", (m) => m.prognoseHuidig],
    // Jouw gevraagde berekening; toekomstige maanden nu leeg:
    ["prognose obv omzet to date", (m) => prognoseObvToDateByMonth.get(m.maand) ?? null],
    ["LONEN", () => null],
    ["Loonkosten", (m) => Number(getLoonkosten(m.maand))],
    ["% van omzet", (m) => getLoonkostenPercentage(m.maand, m.realisatieOmzet)],
  ];

  return (
    <main className="p-6">
      <a
        href="/admin/rapportage/financieel"
        className="text-sm underline text-blue-600 block mb-4"
      >
        ← Financiële Rapportages
      </a>

      {/* Jaarselector */}
      <div className="mb-4">
        <label className="mr-2 text-sm text-gray-600">Jaar:</label>
        <select
          className="border rounded px-2 py-1"
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <h1 className="text-2xl font-bold mb-6">Omzetprognose overzicht</h1>
      <p className="mb-4 text-gray-600">
        Prognose jaaromzet:&nbsp;
        <strong>
          € {jaaromzet.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}
        </strong>
        {vorigJaarOmzet > 0 && (
          <span className="text-gray-500">
            {" "}
            (Omzet vorig jaar: €{" "}
            {vorigJaarOmzet.toLocaleString("nl-NL", {
              maximumFractionDigits: 0,
            })}
            )
          </span>
        )}
      </p>
      <div className="overflow-auto">
        <table className="table-auto border border-collapse w-full text-sm">
          <tbody>
            {rows.map(([label, fn], rowIdx) => (
              <tr
                key={label}
                className={isHeaderLabel(label) ? "bg-gray-200" : "border-t"}
              >
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
                  if (isHeaderLabel(label)) display = maandNamen[m.maand - 3];
                  else if (raw === null || raw === 0) display = "";
                  else if (label === "dagen")
                    display = Math.round(raw).toLocaleString("nl-NL");
                  else if (label === "voor/achter in dagen")
                    display = (raw as number).toLocaleString("nl-NL", {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    });
                  else if (label === "% van omzet")
                    display = (raw as number).toFixed(1) + "%";
                  else
                    display = (raw as number).toLocaleString("nl-NL", {
                      maximumFractionDigits: 0,
                    });

                  let cellClass = "px-2 py-1 text-right font-mono border";
                  if (isHeaderLabel(label))
                    cellClass = "px-2 py-1 text-right font-bold border";
                  if (label === "omzet/dag" && rowIdx === 7 && raw !== null)
                    cellClass +=
                      (raw as number) > (m.prognosePerDag || 0)
                        ? " bg-green-100"
                        : " bg-red-100";
                  if (label === "prognose plusmin" && raw !== null)
                    cellClass += (raw as number) > 0
                      ? " bg-green-100"
                      : " bg-red-100";
                  if (label === "% van omzet" && raw !== null && (raw as number) > 25)
                    cellClass += " bg-red-100";

                  if (label === "Loonkosten") {
                    const item = loonkosten.find((l) => l.maand === m.maand);
                    const incompleet =
                      item &&
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
                      data
                        .reduce((sum, m) => sum + (fn(m) || 0), 0)
                        .toLocaleString("nl-NL", { maximumFractionDigits: 0 })
                    : label === "dagen"
                    ? data
                        .reduce((sum, m) => sum + (fn(m) || 0), 0)
                        .toLocaleString("nl-NL")
                    : label === "omzet/dag"
                    ? (() => {
                        let totOm = 0;
                        let totDg = 0;
                        if (rowIdx <= 3) {
                          totOm = data.reduce((s, m) => s + m.prognoseOmzet, 0);
                          totDg = data.reduce((s, m) => s + m.prognoseDagen, 0);
                        } else if (rowIdx <= 7) {
                          totOm = data.reduce((s, m) => s + m.realisatieOmzet, 0);
                          totDg = data.reduce((s, m) => s + m.realisatieDagen, 0);
                        } else if (rowIdx <= 12) {
                          totOm = data.reduce((s, m) => s + m.todoOmzet, 0);
                          totDg = data.reduce((s, m) => s + m.todoDagen, 0);
                        } else return "";
                        return totDg > 0
                          ? Math.round(totOm / totDg).toLocaleString("nl-NL")
                          : "";
                      })()
                    : label === "Loonkosten"
                    ? "€ " +
                      data
                        .reduce((sum, m) => sum + Number(getLoonkosten(m.maand)), 0)
                        .toLocaleString("nl-NL", { maximumFractionDigits: 0 })
                    : label === "% van omzet"
                    ? (() => {
                        const totaalLoon = data.reduce(
                          (s, m) => s + getLoonkosten(m.maand),
                          0
                        );
                        const totaalOmzet = data.reduce(
                          (s, m) => s + m.realisatieOmzet,
                          0
                        );
                        return totaalOmzet > 0
                          ? ((totaalLoon / totaalOmzet) * 100).toFixed(1) + "%"
                          : "";
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
          Gedaan <strong>{omzetPercent}%</strong> van de omzet in{" "}
          <strong>{dagenPercent}%</strong> van de dagen
        </p>
      </div>
    </main>
  );
}
