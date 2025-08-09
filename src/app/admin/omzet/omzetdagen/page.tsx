"use client";

import useSWR from "swr";
import { useState } from "react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());
const maandNamen = [
  "januari", "februari", "maart", "april", "mei", "juni", "juli",
  "augustus", "september", "oktober", "november", "december"
];

export default function OmzetdagenBeheer() {
  const { data: dagen, mutate } = useSWR("/api/omzetdagen", fetcher);
  const [editCell, setEditCell] = useState<{ jaar: number; maand: number } | null>(null);
  const [inputValue, setInputValue] = useState<string>("");

  if (!dagen) return <div className="p-6">Laden...</div>;

  // Groepeer per jaar
  const dataByJaar: Record<number, { maand: number; dagen: number }[]> = {};
  dagen.forEach((r: any) => {
    if (!dataByJaar[r.jaar]) dataByJaar[r.jaar] = [];
    dataByJaar[r.jaar].push({ maand: r.maand, dagen: r.dagen });
  });

  const alleJaren = Object.keys(dataByJaar).map(Number).sort((a, b) => b - a);

  async function saveCell(jaar: number, maand: number) {
    const waarde = parseInt(inputValue, 10);
    if (isNaN(waarde)) return;
    await fetch("/api/omzetdagen", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jaar, maand, dagen: waarde })
    });
    setEditCell(null);
    setInputValue("");
    mutate();
  }

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-6">Omzetdagen beheren</h1>
      {alleJaren.map((jaar) => (
        <div key={jaar} className="mb-8">
          <h2 className="font-semibold mb-2">{jaar}</h2>
          <table className="table-auto border-collapse border w-full mb-4">
            <thead>
              <tr>
                {maandNamen.map((naam, i) => (
                  <th key={i} className="px-2 py-1 border">{naam}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {maandNamen.map((_, idx) => {
                  const maand = idx + 1;
                  const rec = dataByJaar[jaar].find((d) => d.maand === maand);
                  const val = rec ? rec.dagen : 0;
                  const isEditing = editCell?.jaar === jaar && editCell?.maand === maand;
                  return (
                    <td key={maand} className="border px-2 py-1 text-center bg-white">
                      {isEditing ? (
                        <input
                          className="w-14 px-1 py-1 border rounded text-center"
                          autoFocus
                          type="number"
                          value={inputValue}
                          min={0}
                          max={31}
                          onChange={e => setInputValue(e.target.value)}
                          onBlur={() => saveCell(jaar, maand)}
                          onKeyDown={e => {
                            if (e.key === "Enter") saveCell(jaar, maand);
                            if (e.key === "Escape") setEditCell(null);
                          }}
                        />
                      ) : (
                        <span
                          className="block cursor-pointer hover:bg-blue-100 rounded"
                          onClick={() => {
                            setEditCell({ jaar, maand });
                            setInputValue(val.toString());
                          }}
                          title="Klik om aan te passen"
                        >
                          {val}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </div>
      ))}
    </main>
  );
}
