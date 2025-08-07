'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { format, eachDayOfInterval, parseISO, startOfMonth, endOfMonth } from 'date-fns';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function KasboekPage() {
  const [datum, setDatum] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const maand = datum.slice(0, 7);
  const { data: dagen } = useSWR(`/api/kasboek/dagen?maand=${maand}`, fetcher);

  const [dagId, setDagId] = useState<number | null>(null);
  const [startbedrag, setStartbedrag] = useState('');

  useEffect(() => {
    const bestaande = dagen?.find((d: any) => d.datum === datum);
    if (bestaande) {
      setDagId(bestaande.id);
      setStartbedrag(bestaande.startbedrag?.toString() || '');
    } else {
      setDagId(null);
      setStartbedrag('');
    }
  }, [datum, dagen]);

  const alleDagenVanMaand = eachDayOfInterval({
    start: startOfMonth(parseISO(`${maand}-01`)),
    end: endOfMonth(parseISO(`${maand}-01`)),
  });

  return (
    <div className="p-4 space-y-6 max-w-xl">
      <h1 className="text-xl font-bold">Kasboek {maand}</h1>

      <div className="space-y-1">
        {alleDagenVanMaand.map((dag) => {
          const formatted = format(dag, 'yyyy-MM-dd');
          const record = dagen?.find((d: any) => d.datum === formatted);
          const status = record && parseInt(record.aantal_transacties) > 0 ? '✅' : '⬜';
          const active = datum === formatted;

          return (
            <div
              key={formatted}
              onClick={() => setDatum(formatted)}
              className={`cursor-pointer px-2 py-1 rounded ${
                active ? 'bg-blue-100 font-bold' : ''
              }`}
            >
              {status} {formatted}
            </div>
          );
        })}
      </div>

      <div className="pt-6 border-t">
        <h2 className="font-semibold text-lg">Geselecteerde dag</h2>
        <div className="mt-2">
          <label>Datum:</label>
          <input
            type="date"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            className="border px-2 ml-2"
          />
        </div>
        <div className="mt-2">
          <label>Startbedrag:</label>
          <input
            type="text"
            value={startbedrag}
            readOnly
            className="bg-gray-100 border px-2 ml-2"
          />
        </div>
      </div>
    </div>
  );
}
