'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { format, parseISO } from 'date-fns';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function KasboekPage() {
  const [datum, setDatum] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [dagId, setDagId] = useState<number | null>(null);
  const [startbedrag, setStartbedrag] = useState('');
  const [magWijzigen, setMagWijzigen] = useState(false);

  const { data: dagen } = useSWR(`/api/kasboek/dagen?maand=${datum.slice(0, 7)}`, fetcher);

  useEffect(() => {
    const bestaande = dagen?.find((d: any) => d.datum === datum);
    if (bestaande) {
      setDagId(bestaande.id);
      setStartbedrag(bestaande.startbedrag?.toString() || '');
    } else {
      setDagId(null);
      setStartbedrag('');
    }

    const date = parseISO(datum);
    const isJan1 = date.getDate() === 1 && date.getMonth() === 0;
    setMagWijzigen(isJan1);
  }, [datum, dagen]);

  const slaStartbedragOp = async () => {
    if (!dagId) return;
    await fetch(`/api/kasboek/dagen/${dagId}/startbedrag`, {
      method: 'PATCH',
      body: JSON.stringify({ startbedrag: parseFloat(startbedrag), datum }),
    });
    alert('Beginsaldo opgeslagen');
  };

  return (
    <div className="p-4 space-y-4 max-w-xl">
      <h1 className="text-xl font-bold">Start kasboek</h1>

      <div className="flex gap-4 items-end">
        <div>
          <label>Datum:</label>
          <input
            type="date"
            value={datum}
            onChange={(e) => setDatum(e.target.value)}
            className="border px-2"
          />
        </div>
        <div>
          <label>Startbedrag:</label>
          <input
            type="number"
            step="0.01"
            value={startbedrag}
            onChange={(e) => setStartbedrag(e.target.value)}
            className="border px-2"
            readOnly={!magWijzigen}
          />
        </div>
        {magWijzigen && (
          <button
            onClick={slaStartbedragOp}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Opslaan
          </button>
        )}
      </div>
    </div>
  );
}
