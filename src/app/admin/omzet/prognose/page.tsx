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
  const [jaaromzet, setJaaromzet] = useState<number>(0);
  const [vorigJaarOmzet, setVorigJaarOmzet] = useState<number>(0);
  const [loonkosten, setLoonkosten] = useState<LoonkostenItem[]>([]);
  const [geselecteerdJaar, setGeselecteerdJaar] = useState<number>(new Date().getFullYear() - 1);

  useEffect(() => {
    fetch("/api/prognose/analyse")
      .then((res) => res.json())
      .then((res) => {
        setData(res.resultaten);
        setJaaromzet(res.jaaromzet);
        if (typeof res.vorigJaarOmzet === 'number') {
          setVorigJaarOmzet(res.vorigJaarOmzet);
        }
      });

    fetch("/api/rapportage/loonkosten")
      .then((res) => res.json())
      .then((res) => setLoonkosten(res));
  }, []);

  const getLoonkosten = (maand: number) => {
    const item = loonkosten.find((l) => l.maand === maand);
    if (!item) return 0;
    return (
      Number(item.lonen) +
      Number(item.loonheffing) +
      Number(item.pensioenpremie)
    );
  };;

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
    ["prognose plusmin", (m) => m.plusmin],
    ["prognose obv omzet to date", (m) => m.jrPrognoseObvTotNu],
    ["LONEN", () => null],
    ["Loonkosten", (m) => Number(getLoonkosten(m.maand))],
    ["% van omzet", (m) => getLoonkostenPercentage(m.maand, m.realisatieOmzet)],
  ];

  return (
    <main className="p-6">
      <a href="/admin/rapportage/financieel" className="text-sm underline text-blue-600 block mb-4">← Financiële Rapportages</a>
      <h1 className="text-2xl font-bold mb-6">Omzetprognose overzicht</h1>
      <p className="mb-4 text-gray-600">
        Prognose jaaromzet:&nbsp;
        <strong>
          € {jaaromzet.toLocaleString("nl-NL", { maximumFractionDigits: 0 })}
        </strong>
        {vorigJaarOmzet > 0 && (
          <span className="text-gray-500"> (Omzet vorig jaar: € {vorigJaarOmzet.toLocaleString("nl-NL", { maximumFractionDigits: 0 })})</span>
        )}
      </p>
      <div className="overflow-auto">
        <table className="table-auto border border-collapse w-full text-sm">
          <tbody>
            {rows.map(([label, fn], rowIdx) => (
              <tr key={label} className={isHeaderLabel(label) ? "bg-gray-200" : "border-t"}>
                <td className={`px-2 py-1 text-left whitespace-nowrap ${isHeaderLabel(label) ? "font-bold" : "font-medium"}`}>{label}</td>
                {data.map((m) => {
                  const raw = fn(m);
                  let display = "";
                  if (isHeaderLabel(label)) display = maandNamen[m.maand - 3];
                  else if (raw === null || raw === 0) display = "";
                  else if (label === "dagen") display = Math.round(raw).toLocaleString("nl-NL");
                  else if (label === "voor/achter in dagen") display = raw.toLocaleString("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
                  else if (label === "% van omzet") display = raw.toFixed(1) + "%";
                  else display = raw.toLocaleString("nl-NL", { maximumFractionDigits: 0 });

                  let cellClass = "px-2 py-1 text-right font-mono border";
                  if (isHeaderLabel(label)) cellClass = "px-2 py-1 text-right font-bold border";
                  if (label === "omzet/dag" && rowIdx === 7 && raw !== null) cellClass += raw > (m.prognosePerDag || 0) ? " bg-green-100" : " bg-red-100";
                  if (label === "prognose plusmin" && raw !== null) cellClass += raw > 0 ? " bg-green-100" : " bg-red-100";
                  if (label === "% van omzet" && raw !== null && raw > 25) cellClass += " bg-red-100";

                  if (label === "Loonkosten") {
  const item = loonkosten.find((l) => l.maand === m.maand);
  const incompleet = item && (
    Number(item.lonen) === 0 ||
    Number(item.loonheffing) === 0 ||
    Number(item.pensioenpremie) === 0
  );
  if (incompleet) display += " 🔴";
}
                  return <td key={m.maand + label} className={cellClass}>{display}</td>;
                })}
                <td className="px-2 py-1 text-right font-bold border">
                  {label === "omzet"
                    ? '€ ' + data.reduce((sum, m) => sum + (fn(m) || 0), 0).toLocaleString("nl-NL", { maximumFractionDigits: 0 })
                    : label === "dagen"
                    ? data.reduce((sum, m) => sum + (fn(m) || 0), 0).toLocaleString("nl-NL")
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
                        return totDg > 0 ? Math.round(totOm / totDg).toLocaleString("nl-NL") : "";
                      })()
                    : label === "Loonkosten"
                    ? '€ ' + data.reduce((sum, m) => sum + Number(getLoonkosten(m.maand)), 0).toLocaleString("nl-NL", { maximumFractionDigits: 0 })
                    : label === "% van omzet"
                    ? (() => {
                        const totaalLoon = data.reduce((s, m) => s + getLoonkosten(m.maand), 0);
                        const totaalOmzet = data.reduce((s, m) => s + m.realisatieOmzet, 0);
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
    <section className="mt-12">
  <h2 className="text-xl font-bold mb-4">Realisatie per jaar</h2>
<div className="mb-10">
  <div className="mb-4">
  <label className="mr-2">Toon jaar:</label>
  <select
    value={geselecteerdJaar}
    onChange={(e) => setGeselecteerdJaar(parseInt(e.target.value))}
    className="border px-2 py-1 rounded"
  >
    {[2022, 2023, 2024].map((jaar) => (
      <option key={jaar} value={jaar}>{jaar}</option>
    ))}
  </select>
</div>
<h3 className="font-semibold text-md mb-2">Jaar {geselecteerdJaar}</h3>
  <table className="table-auto border border-collapse w-full text-sm mb-2">
    <thead>
      <tr>
        <th className="text-left px-2 py-1">REALISATIE</th>
        {maandNamen.map((m) => (
          <th key={m} className="text-right px-2 py-1">{m}</th>
        ))}
        <th className="text-right px-2 py-1">TOTAAL</th>
      </tr>
    </thead>
    <tbody>
      {[
  {
    label: 'omzet',
    fn: (m: MaandData) => m.realisatieOmzet,
    format: (val: number) => '€ ' + val.toLocaleString('nl-NL', { maximumFractionDigits: 0 })
  },
  {
    label: 'dagen',
    fn: (m: MaandData) => m.realisatieDagen,
    format: (val: number) => val.toLocaleString('nl-NL')
  },
  {
    label: 'omzet/dag',
    fn: (m: MaandData) => m.realisatiePerDag ?? 0,
    format: (val: number) => '€ ' + Math.round(val).toLocaleString('nl-NL')
  }
].map(({ label, fn, format }) => {
  const startIndex = (geselecteerdJaar - 2022) * 7;
  const rows = data.slice(startIndex, startIndex + 7);
  
  const total = rows.reduce((sum, m) => sum + (fn(m) || 0), 0);
  return (
    <tr key={label} className="border-t">
      <td className="px-2 py-1 text-left font-medium">{label}</td>
      {maandNamen.map((_, i) => {
        const maandIndex = i + 3;
        const match = rows.find(r => r.maand === maandIndex);
        const val = match ? fn(match) : 0;
        return <td key={i} className="px-2 py-1 text-right font-mono">{val ? format(val) : ''}</td>;
      })}
      <td className="px-2 py-1 text-right font-bold">{format(total)}</td>
    </tr>
  );
})}
    </tbody>
  </table>
  <table className="table-auto border border-collapse w-full text-sm">
    <thead>
      <tr>
        <th className="text-left px-2 py-1">LONEN</th>
        {maandNamen.map((m) => (
          <th key={m} className="text-right px-2 py-1">{m}</th>
        ))}
        <th className="text-right px-2 py-1">TOTAAL</th>
      </tr>
    </thead>
    <tbody>
      {[
  {
    label: 'Loonkosten',
    fn: (maand: number) => {
      const l = loonkosten.find((l) => l.jaar === geselecteerdJaar && l.maand === maand);
      return l ? l.lonen + l.loonheffing + l.pensioenpremie : 0;
    },
    format: (val: number) => '€ ' + val.toLocaleString('nl-NL', { maximumFractionDigits: 0 })
  },

    {
  label: '% van omzet',
  fn: (maand: number) => {
    const loonk = loonkosten.find((l) => l.jaar === geselecteerdJaar && l.maand === maand);
    const maandData = data.find((d) => d.maand === maand);
    const omzet = maandData?.realisatieOmzet ?? 0;
    const totaal = loonk ? loonk.lonen + loonk.loonheffing + loonk.pensioenpremie : 0;
    return omzet > 0 ? (totaal / omzet) * 100 : 0;
  },
  format: (val: number) => val.toFixed(1) + '%'
}

].map(({ label, fn, format }) => {
  const startIndex = (geselecteerdJaar - 2022) * 7;
  const rows = data.slice(startIndex, startIndex + 7);
  const total = maandNamen.reduce((sum, _, i) => {
    const maand = i + 3;
    return sum + (fn(maand) || 0);
  }, 0);

  return (
    <tr key={label} className="border-t">
      <td className="px-2 py-1 text-left font-medium">{label}</td>
      {maandNamen.map((_, i) => {
        const maand = i + 3;
        const val = fn(maand);
        return <td key={i} className="px-2 py-1 text-right font-mono">{val ? format(val) : ''}</td>;
      })}
      <td className="px-2 py-1 text-right font-bold">{format(total)}</td>
    </tr>
  );
})}
    </tbody>
  </table>
</div>

</section>
</main>
  );
}
