// Bestand: src/app/admin/notities/page.tsx

'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(res => res.json());

interface Rubriek {
  id: number;
  naam: string;
}
interface Notitie {
  id: number;
  rubriek_id: number;
  tekst: string;
  volgorde: number;
}

export default function NotitieblokPagina() {
  const { data: rubrieken = [], mutate: mutateRubrieken } = useSWR<Rubriek[]>('/api/notities', fetcher, { revalidateOnMount: true });
  const [selRubriek, setSelRubriek] = useState<Rubriek | null>(null);
  const { data: notities = [], mutate: mutateNotities } = useSWR<Notitie[]>(
    selRubriek ? `/api/notities?rubriek_id=${selRubriek.id}` : null,
    fetcher,
    { revalidateOnMount: true }
  );

  const [newRubriekName, setNewRubriekName] = useState('');
  const [newNotitieTekst, setNewNotitieTekst] = useState('');

  useEffect(() => {
    if (rubrieken.length > 0 && !selRubriek) setSelRubriek(rubrieken[0]);
  }, [rubrieken]);

  const addRubriek = async () => {
    if (!newRubriekName.trim()) return;
    await fetch('/api/notities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ naam: newRubriekName.trim() })
    });
    setNewRubriekName('');
    mutateRubrieken();
  };

  const editRubriek = async (r: Rubriek) => {
    const nieuw = prompt('Nieuwe naam voor rubriek:', r.naam);
    if (nieuw && nieuw.trim() && nieuw !== r.naam) {
      await fetch('/api/notities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id, naam: nieuw.trim() })
      });
      if (selRubriek?.id === r.id) setSelRubriek({ ...r, naam: nieuw.trim() });
      mutateRubrieken();
    }
  };

  const deleteRubriek = async (r: Rubriek) => {
    if (confirm(`Weet je zeker dat je rubriek "${r.naam}" wilt verwijderen?`)) {
      await fetch('/api/notities', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id })
      });
      if (selRubriek?.id === r.id) setSelRubriek(null);
      mutateRubrieken();
    }
  };

  const addNotitie = async () => {
    if (!newNotitieTekst.trim() || !selRubriek) return;
    await fetch('/api/notities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rubriek_id: selRubriek.id, tekst: newNotitieTekst.trim() })
    });
    setNewNotitieTekst('');
    mutateNotities();
  };

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="col-span-1 space-y-2">
        <h2 className="text-lg font-semibold">Rubrieken</h2>
        {rubrieken.map(r => (
          <div key={r.id} className="flex items-center justify-between px-2 py-1 border rounded">
            <button
              onClick={() => setSelRubriek(r)}
              className={`text-left flex-1 ${selRubriek?.id === r.id ? 'font-semibold' : ''}`}
            >
              {r.naam}
            </button>
            <div className="flex gap-1">
              <button onClick={() => editRubriek(r)} className="text-blue-500" title="Aanpassen">✎</button>
              <button onClick={() => deleteRubriek(r)} className="text-red-500" title="Verwijderen">🗑️</button>
            </div>
          </div>
        ))}
        <div className="mt-4 flex gap-2">
          <input
            className="flex-1 border rounded px-2 py-1"
            placeholder="Nieuwe rubriek"
            value={newRubriekName}
            onChange={e => setNewRubriekName(e.target.value)}
          />
          <button onClick={addRubriek} className="bg-blue-500 text-white px-3 py-1 rounded">+</button>
        </div>
      </div>

      <div className="col-span-2">
        <h2 className="text-lg font-semibold mb-2">Notities voor “{selRubriek?.naam}”</h2>
        <div className="space-y-4">
          {notities.map(n => (
            <textarea
              key={n.id}
              className="w-full border rounded p-3 h-32 resize-y"
              defaultValue={n.tekst}
              onBlur={async e => {
                const tekst = e.currentTarget.value;
                if (tekst !== n.tekst) {
                  await fetch('/api/notities', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: n.id, tekst })
                  });
                  mutateNotities();
                }
              }}
            />
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <textarea
            className="flex-1 border rounded p-3 h-32 resize-y"
            placeholder="Nieuwe notitie"
            value={newNotitieTekst}
            onChange={e => setNewNotitieTekst(e.target.value)}
          />
          <button onClick={addNotitie} className="bg-green-600 text-white px-4 py-2 rounded">+ Notitie</button>
        </div>
      </div>
    </div>
  );
}