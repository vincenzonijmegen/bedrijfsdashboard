// app/shift-acties/page.tsx
"use client";

import useSWR from "swr";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
dayjs.extend(isoWeek);

interface Actie {
  id: number;
  datum: string;
  shift: string;
  tijd: string;
  van: string;
  naar: string;
  type: string;
  bron_email: string;
}

export default function ShiftActiesPage() {
  const { data, error } = useSWR<Actie[]>("/api/shift-acties", (url: string) =>
    fetch(url).then((res) => res.json())
  );

  if (error) return <p>Fout bij laden</p>;
  if (!data) return <p>Laden...</p>;

  const grouped = data.reduce((acc, actie) => {
    const week = dayjs(actie.datum).isoWeek();
    acc[week] = acc[week] || [];
    acc[week].push(actie);
    return acc;
  }, {} as Record<number, Actie[]>);

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">📊 Shiftacties & Statistieken</h1>

      {Object.entries(grouped).sort(([a], [b]) => Number(b) - Number(a)).map(([week, acties]) => (
        <div key={week} className="mb-10">
          <h2 className="text-xl font-semibold mb-2">Week {week}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border">
              <thead className="bg-gray-100">
                <tr>
                  <th className="p-2 border">Datum</th>
                  <th className="p-2 border">Shift</th>
                  <th className="p-2 border">Tijd</th>
                  <th className="p-2 border">Van</th>
                  <th className="p-2 border">Naar</th>
                  <th className="p-2 border">Type</th>
                </tr>
              </thead>
              <tbody>
                {acties.map((item) => (
                  <tr key={item.id} className="odd:bg-white even:bg-gray-50">
                    <td className="p-2 border">{dayjs(item.datum).format("ddd D MMM YYYY")}</td>
                    <td className="p-2 border">{item.shift}</td>
                    <td className="p-2 border">{item.tijd}</td>
                    <td className="p-2 border">{item.van}</td>
                    <td className="p-2 border">{item.naar}</td>
                    <td className="p-2 border">{item.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
