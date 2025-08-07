'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { format } from 'date-fns';

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const CATEGORIEEN = [
  { key: 'verkopen_laag', label: 'Verkopen laag', type: 'ontvangst', btw: '9%' },
  { key: 'verkoop_kadobonnen', label: 'Verkoop kadobonnen', type: 'ontvangst', btw: '9%' },
  { key: 'wisselgeld_van_bank', label: 'Wisselgeld van bank', type: 'ontvangst', btw: 'geen' },
  { key: 'prive_opname_herman', label: 'Privé opname Herman', type: 'uitgave', btw: 'geen' },
  { key: 'prive_opname_erik', label: 'Privé opname Erik', type: 'uitgave', btw: 'geen' },
  { key: 'ingenomen_kadobon', label: 'Ingenomen kadobonnen', type: 'uitgave', btw: '9%' },
  { key: 'naar_bank_afgestort', label: 'Naar bank afgestort', type: 'uitgave', btw: 'geen' },
  { key: 'kasverschil', label: 'Kasverschil', type: 'uitgave', btw: 'geen' },
];

export default function KasboekPage() {
  const [datum, setDatum] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [dagId, setDagId] = useState<number | null>(null);
  const [startbedrag, setStartbedrag] = useState('');
  const [eindsaldo, setEindsaldo] = useState('');
  const [bedragen, setBedragen] = useState<Record<string, string>>({});
  const [inkoopRijen, setInkoopRijen] = useState<string[]>(['']);

  const { data: dagen } = useSWR(`/api/kasboek/dagen?maand=${datum.slice(0, 7)}`, fetcher);
  const { data: transacties, mutate } = useSWR(
    dagId ? `/api/kasboek/dagen/${dagId}/transacties` : null,
    fetcher
  );

  useEffect(() => {
    const bestaande = dagen?.find((d: any) => d.datum === datum);
    if (bestaande) {
      setDagId(bestaande.id);
      setStartbedrag(bestaande.startbedrag);
      setEindsaldo(bestaande.eindsaldo ?? '');
    } else {
      setDagId(null);
      setStartbedrag('');
      setEindsaldo('');
    }
    setBedragen({});
    setInkoopRijen(['']);
  }, [datum, dagen]);

  const maakDagAan = async () => {
    const res = await fetch('/api/kasboek/dagen', {
      method: 'POST',
      body: JSON.stringify({ datum, startbedrag: parseFloat(startbedrag) }),
    });
    const dag = await res.json();
    setDagId(dag.id);
  };

  const opslaan = async () => {
    if (!dagId) return;
    for (const cat of CATEGORIEEN) {
      const val = bedragen[cat.key];
      if (val) {
        await fetch(`/api/kasboek/dagen/${dagId}/transacties`, {
          method: 'POST',
          body: JSON.stringify({
            type: cat.type,
            categorie: cat.key,
            bedrag: parseFloat(val),
            btw: cat.btw === 'geen' ? null : cat.btw,
            omschrijving: null,
          }),
        });
      }
    }
    for (const bedrag of inkoopRijen) {
      if (bedrag) {
        await fetch(`/api/kasboek/dagen/${dagId}/transacties`, {
          method: 'POST',
          body: JSON.stringify({
            type: 'uitgave',
            categorie: 'contant_inkoop',
            bedrag: parseFloat(bedrag),
            btw: null,
            omschrijving: null,
          }),
        });
      }
    }
    await mutate();
  };

  const slaEindsaldoOp = async () => {
    if (!dagId) return;
    await fetch(`/api/kasboek/dagen/${dagId}/eindsaldo`, {
      method: 'PATCH',
      body: JSON.stringify({ eindsaldo: parseFloat(eindsaldo) }),
    });
  };

  return (
    <div className="p-4 space-y-4 max-w-3xl">
      <h1 className="text-xl font-bold">Kasboek – {datum}</h1>
      <div className="flex gap-4 items-end">
        <div>
          <label>Datum:</label>
          <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} className="border px-2" />
        </div>
        <div>
          <label>Startbedrag:</label>
          <input
            type="number"
            step="0.01"
            value={startbedrag}
            onChange={(e) => setStartbedrag(e.target.value)}
            className="border px-2"
          />
        </div>
        {!dagId && (
          <button onClick={maakDagAan} className="bg-blue-600 text-white px-4 py-2 rounded">Maak dag aan</button>
        )}
      </div>

      {dagId && (
        <>
          <table className="w-full text-sm border mt-6">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-2 py-1">Categorie</th>
                <th>Type</th>
                <th>BTW</th>
                <th>Bedrag</th>
              </tr>
            </thead>
            <tbody>
              {CATEGORIEEN.map((cat) => (
                <tr key={cat.key} className="border-t">
                  <td className="px-2 py-1">{cat.label}</td>
                  <td>{cat.type}</td>
                  <td>{cat.btw}</td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={bedragen[cat.key] || ''}
                      onChange={(e) => setBedragen({ ...bedragen, [cat.key]: e.target.value })}
                      className="border px-2 w-32"
                    />
                  </td>
                </tr>
              ))}
              {inkoopRijen.map((val, i) => (
                <tr key={`inkoop-${i}`} className="border-t">
                  <td className="px-2 py-1">Contant betaalde inkoop</td>
                  <td>uitgave</td>
                  <td>–</td>
                  <td>
                    <input
                      type="number"
                      step="0.01"
                      value={val}
                      onChange={(e) => {
                        const kopie = [...inkoopRijen];
                        kopie[i] = e.target.value;
                        setInkoopRijen(kopie);
                      }}
                      className="border px-2 w-32"
                    />
                  </td>
                </tr>
              ))}
              <tr>
                <td colSpan={4}>
                  <button
                    className="text-blue-600 underline px-2 mt-2"
                    onClick={() => setInkoopRijen([...inkoopRijen, ''])}
                  >
                    + Extra inkoopregel
                  </button>
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-4 flex items-center gap-4">
            <button onClick={opslaan} className="bg-green-600 text-white px-4 py-2 rounded">Sla transacties op</button>
            <div>
              <label>Eindsaldo:</label>
              <input
                type="number"
                step="0.01"
                value={eindsaldo}
                onChange={(e) => setEindsaldo(e.target.value)}
                className="border px-2 ml-2"
              />
              <button onClick={slaEindsaldoOp} className="ml-4 bg-blue-500 text-white px-4 py-1 rounded">Opslaan</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
