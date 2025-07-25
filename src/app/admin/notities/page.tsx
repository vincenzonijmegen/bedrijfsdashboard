// Bestand: src/app/admin/notities/page.tsx

'use client';

import { useState, useEffect, useRef } from 'react';
import useSWR from 'swr';
import Link from 'next/link';

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(res => res.json());

interface Rubriek { id: number; naam: string; }
interface Notitie { id: number; rubriek_id: number; tekst: string; volgorde: number; }

// Functie om HTML-tags te strippen voor de title-tooltip
const stripHTML = (html: string) => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

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

  // Nieuwe rubriek
  const [newRubriekName, setNewRubriekName] = useState('');
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
    if (nieuw?.trim() && nieuw !== r.naam) {
      await fetch('/api/notities', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id, naam: nieuw.trim(), type: 'rubriek' })
      });
      setSelRubriek(prev => prev && prev.id === r.id ? { ...prev, naam: nieuw.trim() } : prev);
      mutateRubrieken();
    }
  };

  const deleteRubriek = async (r: Rubriek) => {
    if (confirm(`Rubriek "${r.naam}" verwijderen?`)) {
      await fetch('/api/notities', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id, type: 'rubriek' })
      });
      if (selRubriek?.id === r.id) setSelRubriek(null);
      mutateRubrieken();
    }
  };

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
      body: JSON.stringify({ id, tekst: html, type: 'notitie' })
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
      {/* Rubriekenlijst met bewerk/delete */}
      <div className="col-span-1 space-y-2">
        <h2 className="text-lg font-semibold">Rubrieken</h2>
        {sortedRubrieken.map(r => (
          <div key={r.id} className="flex items-center justify-between px-2 py-1 border rounded">
            <button onClick={() => setSelRubriek(r)} className={`flex-1 text-left ${selRubriek?.id === r.id ? 'font-semibold' : ''}`}>{r.naam}</button>
            <div className="flex gap-1">
              <button onClick={() => editRubriek(r)} title="Aanpassen">✎</button>
              <button onClick={() => deleteRubriek(r)} title="Verwijderen">🗑️</button>
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

      {/* Notitiespanelen */}
      <div className="col-span-2">
        <h2 className="text-lg font-semibold mb-2">Notities voor “{selRubriek?.naam}”</h2>
        <div className="space-y-4">
          {notities.map(n => (
            <div key={n.id} className="relative border rounded">
              <div className="bg-gray-100 p-1 flex gap-2">
                <button onMouseDown={e => { e.preventDefault(); execCommand('bold'); }} className="font-bold">B</button>
                <button onMouseDown={e => { e.preventDefault(); execCommand('italic'); }} className="italic">I</button>
                <button onClick={() => deleteNotitie(n.id)} className="ml-auto text-red-500">🗑️</button>
              </div>
              <div
                className="p-3 w-full min-h-[8rem] resize-y overflow-auto"
                style={{ resize: 'vertical' }}
                title={stripHTML(n.tekst)}
                contentEditable
                suppressContentEditableWarning
                defaultValue={n.tekst}
                onBlur={async e => { await updateNotitie(n.id, e.currentTarget.innerHTML); mutateNotities(); }}
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
            className="mt-1 p-3 w-full min-h-[8rem] resize-y border rounded overflow-auto"
            style={{ resize: 'vertical' }}
            contentEditable
            suppressContentEditableWarning
            onInput={e => setNewNotitieHtml((e.currentTarget as HTMLDivElement).innerHTML)}
          />
        </div>
      </div>
    </div>
  );
}
