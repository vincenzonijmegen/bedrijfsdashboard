"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import Link from "next/link";

type Klok = {
  id: string;
  user_id: string;
  start: string;
  end: string;
  approved: boolean;
  user?: {
    id: string;
    name: string;
  };
};

export default function NietGoedgekeurdeKlokuren() {
  const [data, setData] = useState<Klok[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date();
    const min = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30)
      .toISOString()
      .slice(0, 10);

    fetch(`/api/shiftbase/klokuren?approved=false&min_date=${min}`)
      .then((res) => res.json())
      .then((json) => {
        setData(json.data);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="p-4">Laden…</p>;

  return (
    <div className="p-4 max-w-4xl mx-auto">
      <Link
        href="/"
        className="inline-block mb-6 text-blue-600 hover:underline font-medium"
      >
        ← Terug naar startpagina
      </Link>

      <h1 className="text-2xl font-bold mb-6">Niet-goedgekeurde klokuren</h1>

      <table className="w-full border border-gray-300 text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-3 py-2 text-left">Datum</th>
            <th className="border px-3 py-2 text-left">Medewerker</th>
            <th className="border px-3 py-2 text-left">Start</th>
            <th className="border px-3 py-2 text-left">Einde</th>
          </tr>
        </thead>
        <tbody>
          {data.map((klok) => (
            <tr key={klok.id}>
              <td className="border px-3 py-2">
                {format(parseISO(klok.start), "dd-MM-yyyy")}
              </td>
              <td className="border px-3 py-2">{klok.user?.name || klok.user_id}</td>
              <td className="border px-3 py-2">
                {format(parseISO(klok.start), "HH:mm")}
              </td>
              <td className="border px-3 py-2">
                {klok.end ? format(parseISO(klok.end), "HH:mm") : "-"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
