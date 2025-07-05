"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import Link from "next/link";

type Tijdregel = {
  id: string;
  date: string;
  starttime: string;
  endtime: string;
  user_id: string;
  user_name?: string;
  status: string;
  total: string;
};

export default function NietGoedgekeurdeUren() {
  const [data, setData] = useState<Tijdregel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const min = new Date();
    min.setDate(min.getDate() - 30);
    const minDate = min.toISOString().slice(0, 10);

    Promise.all([
      fetch(`/api/shiftbase/timesheets?min_date=${minDate}`).then((res) => res.json()),
      fetch(`/api/shiftbase/medewerkers`).then((res) => res.ok ? res.json() : Promise.resolve({ data: [] })),
    ]).then(([timesheetsRes, medewerkersRes]) => {
      const medewerkers = Array.isArray(medewerkersRes?.data)
        ? Object.fromEntries(
            medewerkersRes.data
              .filter((m: any) => m.fullName !== "Anonymous User")
              .map((m: any) => [m.id, m.fullName])
          )
        : {};

      const regels = timesheetsRes.data
        .map((item: any) => item.Timesheet)
        .filter((r: any) => r.status !== "Approved" && r.status !== "Declined")
        .map((r: any) => ({
          id: r.id,
          date: r.date,
          starttime: r.starttime,
          endtime: r.endtime,
          user_id: r.user_id,
          user_name: medewerkers[r.user_id] || r.user_id,
          status: r.status,
          total: r.total,
        }));
      setData(regels);
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

      <h1 className="text-2xl font-bold mb-6">Niet-goedgekeurde uren</h1>

      <table className="w-full border border-gray-300 text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-3 py-2 text-left">Datum</th>
            <th className="border px-3 py-2 text-left">Medewerker</th>
            <th className="border px-3 py-2 text-left">Start</th>
            <th className="border px-3 py-2 text-left">Einde</th>
            <th className="border px-3 py-2 text-left">Totaal</th>
            <th className="border px-3 py-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.id}>
              <td className="border px-3 py-2">{format(parseISO(r.date), "dd-MM-yyyy")}</td>
              <td className="border px-3 py-2">{r.user_name}</td>
              <td className="border px-3 py-2">{r.starttime}</td>
              <td className="border px-3 py-2">{r.endtime}</td>
              <td className="border px-3 py-2">{r.total} uur</td>
              <td className="border px-3 py-2">{r.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
