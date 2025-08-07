'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { format } from 'date-fns';

const fetcher = (url: string) => fetch(url).then(r => r.json());

const categorieLabels: Record<string, string> = {
  verkopen_laag: 'Verkopen laag',
  verkoop_kadobonnen: 'Verkoop kadobonnen',
  wisselgeld_van_bank: 'Wisselgeld van bank',
  prive_opname_herman: 'Privé opname Herman',
  prive_opname_erik: 'Privé opname Erik',
  ingenomen_kadobon: 'Ingenomen kadobonnen',
  contant_inkoop: 'Contant betaalde inkoop',
  naar_bank_afgestort: 'Naar bank afgestort',
  kasverschil: 'Kasverschil',
};

export default function KasboekPage() {
  const [datum, setDatum] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [dagId, setDagId] = useState<number | null>(null);
  const [startbedrag, setStartbedrag] = useState<number | null>(null);
  const [eindsaldo, setEindsaldo] = useState<number | null>(null);
  const [newTransactie, setNewTransactie] = useState({
    type: 'ontvangst',
    categorie: 'verkopen_laag',
    bedrag: '',
    btw: '9%',
    omschrijving: '',
  });

  const { data: dagen } = useSWR(`/api/kasboek/dagen?maand=${datum.slice(0, 7)}`, fetcher);
  const { data: transacties, mutate } = useSWR(
    dagId ? `/api/kasboek/dagen/${dagId}/transacties` : null,
    fetcher
  );

  useEffect(() => {
    const bestaandeDag = dagen?.find((d: any) => d.datum === datum);
    if (bestaandeDag) {
      setDagId(bestaandeDag.id);
      setStartbedrag(bestaandeDag.startbedrag);
      setEindsaldo(bestaandeDag.eindsaldo);
    } else {
      setDagId(null);
      setStartbedrag(null);
      setEindsaldo(null);
    }
  }, [datum, dagen]);

  const maakDagAan = async () => {
    const res = await fetch('/api/kasboek/dagen', {
      method: 'POST',
      body: JSON.stringify({ datum, startbedrag }),
    });
    const dag = await res.json();
    setDagId(dag.id);
  };

  const voegTransactieToe = async () => {
    if (!dagId) return;
    await fetch(`/api/kasboek/dagen/${dagId}/transacties`, {
      method: 'POST',
      body: JSON.stringify({
        ...newTransactie,
        bedrag: parseFloat(newTransactie.bedrag),
        btw: newTransactie.btw === 'geen' ? null : newTransactie.btw,
        omschrijving: newTransactie.omschrijving || null,
      }),
    });
    mutate();
    setNewTransactie({ ...newTransactie, bedrag: '', omschrijving: '' });
  };

  const slaEindsaldoOp = async () => {
    if (!dagId) return;
    await fetch(`/api/kasboek/dagen/${dagId}/eindsaldo`, {
      method: 'PATCH',
      body: JSON.stringify({ eindsaldo }),
    });
  };

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Kasboek – {datum}</h1>

      <div className="flex gap-4 items-end">
        <div>
          <label>Datum:</label>
          <input type="date" value={datum} onChange={e => setDatum(e.target.value)} className="border px-2" />
        </div>
        <div>
          <label>Startbedrag:</label>
          <input type="number" step="0.01" value={startbedrag ?? ''} onChange={e => setStartbedrag(parseFloat(e.target.value))} className="border px-2" />
        </div>
        {!dagId && (
          <button onClick={maakDagAan} className="bg-blue-600 text-white px-4 py-2 rounded">Maak dag aan</button>
        )}
      </div>

      {dagId && (
        <>
          <div className="border-t pt-4">
            <h2 className="font-semibold">Transacties</h2>
            <div className="grid grid-cols-5 gap-2 items-center mt-2">
              <select value={newTransactie.type} onChange={e => setNewTransactie({ ...newTransactie, type: e.target.value })} className="border px-2">
                <option value="ontvangst">Ontvangst</option>
                <option value="uitgave">Uitgave</option>
              </select>
              <select value={newTransactie.categorie} onChange={e => setNewTransactie({ ...newTransactie, categorie: e.target.value })} className="border px-2">
                {Object.entries(categorieLabels).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
              <input type="number" value={newTransactie.bedrag} onChange={e => setNewTransactie({ ...newTransactie, bedrag: e.target.value })} placeholder="Bedrag" className="border px-2" />
              <select value={newTransactie.btw} onChange={e => setNewTransactie({ ...newTransactie, btw: e.target.value })} className="border px-2">
                <option value="9%">9%</option>
                <option value="geen">Geen</option>
              </select>
              <input type="text" value={newTransactie.omschrijving} onChange={e => setNewTransactie({ ...newTransactie, omschrijving: e.target.value })} placeholder="Omschrijving" className="border px-2" />
            </div>
            <button onClick={voegTransactieToe} className="mt-2 bg-green-600 text-white px-4 py-1 rounded">Voeg toe</button>
          </div>

          <div className="mt-6">
            <table className="w-full text-sm border">
              <thead>
                <tr className="bg-gray-100">
                  <th className="text-left px-2 py-1">Type</th>
                  <th>Categorie</th>
                  <th>Bedrag</th>
                  <th>BTW</th>
                  <th>Omschrijving</th>
                </tr>
              </thead>
              <tbody>
                {transacties?.map((t: any) => (
                  <tr key={t.id} className="border-t">
                    <td className="px-2 py-1">{t.type}</td>
                    <td>{categorieLabels[t.categorie]}</td>
                    <td>€ {Number(t.bedrag).toFixed(2)}</td>
                    <td>{t.btw || '–'}</td>
                    <td>{t.omschrijving || '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6">
            <label>Eindsaldo:</label>
            <input type="number" step="0.01" value={eindsaldo ?? ''} onChange={e => setEindsaldo(parseFloat(e.target.value))} className="border px-2 ml-2" />
            <button onClick={slaEindsaldoOp} className="ml-4 bg-blue-500 text-white px-4 py-1 rounded">Opslaan</button>
          </div>
        </>
      )}
    </div>
  );
}
