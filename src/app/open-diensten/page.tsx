"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import Link from "next/link";

type Dienst = {
  id: string;
  date: string;
  starttime: string;
  endtime: string;
  description: string;
  shift: {
    long_name: string;
    color: string;
  };
};

export default function OpenDienstenPerWeek() {
  const [data, setData] = useState<Dienst[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date();
    const inFourWeeks = new Date();
    inFourWeeks.setDate(today.getDate() + 100);

    const min = today.toISOString().slice(0, 10);
    const max = inFourWeeks.toISOString().slice(0, 10);

    fetch(`/api/shiftbase/open-diensten?min_date=${min}&max_date=${max}`)
      .then((res) => res.json())
      .then((json) => {
        const diensten = json.data.map((item: any) => ({
          ...item.OpenShift,
          shift: item.Shift,
        }));
        setData(diensten);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="p-4">Laden…</p>;

  const dienstenPerWeek: Record<string, Dienst[]> = {};
  data.forEach((d) => {
    const week = getWeekNumber(d.date);
    if (!dienstenPerWeek[week]) dienstenPerWeek[week] = [];
    dienstenPerWeek[week].push(d);
  });

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <Link
        href="/"
        className="inline-block mb-6 text-blue-600 hover:underline font-medium"
      >
        ← Terug naar startpagina
      </Link>

      <h1 className="text-2xl font-bold mb-6">Open diensten per week</h1>

      {Object.entries(dienstenPerWeek)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([weekNr, diensten]) => (
          <div key={weekNr} className="mb-8">
            <h2 className="text-xl font-semibold mb-2">Week {weekNr}</h2>
            <table className="w-full border border-gray-300 text-sm table-fixed">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border px-3 py-2 text-left w-[20%]">Datum</th>
                  <th className="border px-3 py-2 text-left w-[10%]">Dag</th>
                  <th className="border px-3 py-2 text-left w-[20%]">Starttijd</th>
                  <th className="border px-3 py-2 text-left w-[20%]">Eindtijd</th>
                  <th className="border px-3 py-2 text-left w-[30%]">Dienst</th>
                </tr>
              </thead>
              <tbody>
                {diensten
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((d) => (
                    <tr key={d.id} className="align-top">
                      <td className="border px-3 py-2">
                        {format(parseISO(d.date), "dd-MM-yyyy")}
                      </td>
                      <td className="border px-3 py-2">
                        {format(parseISO(d.date), "eee", { locale: nl })}
                      </td>
                      <td className="border px-3 py-2">{d.starttime}</td>
                      <td className="border px-3 py-2">{d.endtime}</td>
                      <td className="border px-3 py-2">
                        <span
                          className="inline-block px-2 py-0.5 rounded text-white text-xs font-medium"
                          style={{
                            backgroundColor: d.shift?.color || "#999",
                          }}
                        >
                          {d.description || d.shift?.long_name}
                        </span>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ))}
    </div>
  );
}

function getWeekNumber(isoDate: string): string {
  const date = parseISO(isoDate);
  const jan1 = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor(
    (date.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000)
  );
  return String(Math.ceil((days + jan1.getDay() + 1) / 7));
}
