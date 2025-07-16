// Bestand: src/app/admin/notities/page.tsx

'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(res => res.json());

interface Rubriek { id: number; naam: string; }
interface Notitie { id: number; rubriek_id: number; tekst: string; volgorde: number; }

export default function NotitieblokPagina() {
  // Rubrieken ophalen en sorteren
  const { data: rubrieken = [], mutate: mutateRubrieken } = useSWR<Rubriek[]>('/api/notities', fetcher, { revalidateOnMount: true });
  const sortedRubrieken = [...rubrieken].sort((a, b) => a.naam.localeCompare(b.naam));

  const [selRubriek, setSelRubriek] = useState<Rubriek | null>(null);
  const { data: notities = [], mutate: mutateNotities } = useSWR<Notitie[]>(
    selRubriek ? `/api/notities?rubriek_id=${selRubriek.id}` : null,
    fetcher,
    { revalidateOnMount: true }
  );

  // Nieuwe notitie HTML
  const [newNotitieHtml, setNewNotitieHtml] = useState('');
  const newRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (sortedRubrieken.length && !selRubriek) setSelRubriek(sortedRubrieken[0]);
  }, [sortedRubrieken]);

  const addNotitie = async () => {
    if (!newNotitieHtml.trim() || !selRubriek) return;
    await fetch('/api/notities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rubriek_id: selRubriek.id, tekst: newNotitieHtml })
    });
    setNewNotitieHtml('');
    if (newRef.current) newRef.current.innerHTML = '';
    mutateNotities();
  };

  const updateNotitie = async (id: number, html: string) => {
    await fetch('/api/notities', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, tekst: html })
    });
  };

  const deleteNotitie = async (id: number) => {
    if (!confirm('Notitie verwijderen?')) return;
    await fetch('/api/notities', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, type: 'notitie' }) });
    mutateNotities();
  };

  const execCommand = (cmd: string) => { document.execCommand(cmd, false, ''); newRef.current?.focus(); };

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="col-span-1 space-y-2">
        <Link href="/admin/rapportage" className="text-sm underline text-blue-600">← Terug naar Rapportage</Link>
        <h2 className="text-lg font-semibold">Rubrieken</h2>
        {sortedRubrieken.map(r => (
          <button key={r.id} onClick={() => setSelRubriek(r)} className={`w-full text-left px-4 py-2 border rounded ${selRubriek?.id === r.id ? 'bg-gray-100 font-semibold' : 'hover:bg-gray-50'}`}>{r.naam}</button>
        ))}
      </div>

      <div className="col-span-2">
        <h2 className="text-lg font-semibold mb-2">Notities voor “{selRubriek?.naam}”</h2>
        <div className="space-y-4">
          {notities.map(n => (
            <div key={n.id} className="relative border rounded">
              <div className="bg-gray-100 p-1 flex gap-2">
                <button onClick={() => execCommand('bold')} className="font-bold">B</button>
                <button onClick={() => execCommand('italic')} className="italic">I</button>
                <button onClick={() => deleteNotitie(n.id)} className="ml-auto text-red-500">🗑️</button>
              </div>
              <div
                className="p-3 h-32 overflow-auto"
                contentEditable
                suppressContentEditableWarning
                defaultValue={n.tekst}
                onBlur={e => updateNotitie(n.id, e.currentTarget.innerHTML)}
                dangerouslySetInnerHTML={{ __html: n.tekst }}
              />
            </div>
          ))}
        </div>

        <div className="mt-4">
          <div className="bg-gray-100 p-1 flex gap-2">
            <button onClick={() => execCommand('bold')} className="font-bold">B</button>
            <button onClick={() => execCommand('italic')} className="italic">I</button>
            <button onClick={addNotitie} className="bg-green-600 text-white px-4 py-1 rounded ml-auto">+ Notitie</button>
          </div>
          <div
            ref={newRef}
            className="mt-1 p-3 h-32 border rounded overflow-auto"
            contentEditable
            suppressContentEditableWarning
            onInput={e => setNewNotitieHtml((e.currentTarget as HTMLDivElement).innerHTML)}
          />
        </div>
      </div>
    </div>
  );
}
