// app/shift-acties/page.tsx
"use client";

import { useState } from "react";
import useSWR from "swr";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import Link from "next/link";
import { useRouter } from 'next/navigation';
import "dayjs/locale/nl";

dayjs.extend(isoWeek);
dayjs.locale("nl");

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
  const [filterWeek, setFilterWeek] = useState<'all' | 'thisWeek'>('all');
  const router = useRouter();
  const { data, error } = useSWR<Actie[]>('/api/shift-acties', (url: string) => fetch(url).then(res => res.json()));
  const huidigeWeek = dayjs().isoWeek();
  const filteredData = data?.filter(a => filterWeek === 'all' || dayjs(a.datum).isoWeek() >= huidigeWeek) || [];

  if (error) return <p>Fout bij laden</p>;
  if (!data) return <p>Laden...</p>;

  // Groeperen op weeknummer
  const grouped = filteredData.reduce((acc, actie) => {
    const week = dayjs(actie.datum).isoWeek();
    acc[week] = acc[week] || [];
    acc[week].push(actie);
    return acc;
  }, {} as Record<number, Actie[]>);

  // Statistieken
  const totalActies = data.length;
  const openActies = data.filter(a => a.type === 'Open dienst opgepakt').length;
  const ruilActies = data.filter(a => a.type === 'Ruil geaccepteerd').length;

  return (
    <div className="max-w-5xl mx-auto p-6">
<Link href="/" className="inline-flex items-center text-sm text-blue-600 hover:underline gap-1">
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.75L12 3l9 6.75v9a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18.75v-9z" />
  </svg>
  Start
</Link>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">📊 Shiftacties & Statistieken</h1>
        <Link href="/shift-acties/parse" className="text-sm text-blue-600 hover:underline">
          ➕ Nieuwe shiftactie invoeren
        </Link>
      </div>

      <div className="mb-6">
        <label className="mr-4">
          <input
            type="radio"
            name="filter"
            value="all"
            checked={filterWeek === 'all'}
            onChange={() => setFilterWeek('all')}
            className="mr-1"
          /> Alles
        </label>
        <label>
          <input
            type="radio"
            name="filter"
            value="thisWeek"
            checked={filterWeek === 'thisWeek'}
            onChange={() => setFilterWeek('thisWeek')}
            className="mr-1"
          /> Vanaf deze week
        </label>
      </div>

      {Object.entries(grouped)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([week, acties]) => (
          <div key={week} className="mb-10">
            <h2 className="text-xl font-semibold mb-2">Week {week}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border">
                <thead className="bg-blue-900 text-white">
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
                  {acties
                    .sort((a, b) => dayjs(a.datum).diff(dayjs(b.datum)))
                    .map(item => {
                      const kleur =
                        item.type === 'Open dienst opgepakt'
                          ? 'bg-yellow-50'
                          : item.type === 'Ruil geaccepteerd'
                          ? 'bg-green-50'
                          : '';
                      return (
                        <tr key={item.id} className={`${kleur} border-b`}>
                          <td className="p-2 border">
                            {dayjs(item.datum).format('ddd D MMMM YYYY')}
                          </td>
                          <td className="p-2 border">{item.shift}</td>
                          <td className="p-2 border">{item.tijd}</td>
                          <td className="p-2 border">{item.van}</td>
                          <td className="p-2 border">{item.naar}</td>
                          <td className="p-2 border">{item.type}</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

      <div className="mt-6 border-t pt-4">
        <h2 className="text-xl font-semibold mb-2">Samenvatting statistieken</h2>
        <p>Totaal aantal shiftacties: {totalActies}</p>
        <p>Aantal open diensten opgepakt: {openActies}</p>
        <p>Aantal ruilacties geaccepteerd: {ruilActies}</p>
      </div>

      {/* Statistieken per persoon */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        {/* Open diensten opgepakt */}
        <div className="p-4 border rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Open diensten opgepakt</h3>
          <ul>
            {(() => {
              const counts: Record<string, number> = {};
              data.forEach(a => {
                if (a.type === 'Open dienst opgepakt') counts[a.naar] = (counts[a.naar] || 0) + 1;
              });
              return Object.entries(counts)
                .sort(([, a], [, b]) => b - a)
                .map(([naam, count]) => (
                  <li key={naam} className="mb-1"><strong>{naam}</strong>: {count}×</li>
                ));
            })()}
          </ul>
        </div>

        {/* Shift overgenomen door */}
        <div className="p-4 border rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Shift overgenomen door</h3>
          <ul>
            {(() => {
              const counts: Record<string, number> = {};
              data.forEach(a => {
                if (a.type === 'Ruil geaccepteerd') counts[a.naar] = (counts[a.naar] || 0) + 1;
              });
              return Object.entries(counts)
                .sort(([, a], [, b]) => b - a)
                .map(([naam, count]) => (
                  <li key={naam} className="mb-1"><strong>{naam}</strong>: {count}×</li>
                ));
            })()}
          </ul>
        </div>

        {/* Shift overgenomen van */}
        <div className="p-4 border rounded-lg">
          <h3 className="text-lg font-semibold mb-2">Shift overgenomen van</h3>
          <ul>
            {(() => {
              const counts: Record<string, number> = {};
              data.forEach(a => {
                if (a.type === 'Ruil geaccepteerd' && a.van) counts[a.van] = (counts[a.van] || 0) + 1;
              });
              return Object.entries(counts)
                .sort(([, a], [, b]) => b - a)
                .map(([naam, count]) => (
                  <li key={naam} className="mb-1"><strong>{naam}</strong>: {count}×</li>
                ));
            })()}
          </ul>
        </div>
      </div>

      <Link
        href="/shift-acties/parse"
        className="inline-block text-sm text-blue-600 hover:underline mt-6"
      >
        ➕ Nieuwe shiftactie invoeren
      </Link>
    </div>
  );
}
