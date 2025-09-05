// Bestand: src/app/admin/notities/page.tsx
'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import dynamic from 'next/dynamic';

// Tiptap editor component (client-only)
const NotitieEditor = dynamic(() => import('@/components/NotitieEditor'), { ssr: false });

const fetcher = (url: string) => fetch(url, { cache: 'no-store' }).then(res => res.json());

interface Rubriek { id: number; naam: string; }
interface Notitie { id: number; rubriek_id: number; tekst: string; volgorde: number; }

// Functie om HTML-tags te strippen voor de title-tooltip
const stripHTML = (html: string) => {
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
};

function NotitieRow({
  n,
  onSaved,
  onDelete,
}: {
  n: Notitie;
  onSaved: () => void;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [html, setHtml] = useState<string>(n.tekst);

  // Sync serverdata naar lokale state wanneer NIET aan het editen
  useEffect(() => {
    if (!editing) setHtml(n.tekst);
  }, [n.tekst, editing]);

  const handleSave = async () => {
    await fetch('/api/notities', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: n.id, tekst: html, type: 'notitie' }),
    });
    setEditing(false);
    onSaved();
  };

  const handleCancel = () => {
    setHtml(n.tekst);
    setEditing(false);
  };

  return (
    <div className="relative border rounded" key={`row-${n.id}`}>
      <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 border-b">
        <div className="ml-auto flex gap-2">
          {!editing && (
            <button onClick={() => setEditing(true)} className="px-2 py-1 rounded border">
              Bewerken
            </button>
          )}
          {editing && (
            <>
              <button onClick={handleSave} className="px-2 py-1 rounded bg-blue-600 text-white">
                Opslaan
              </button>
              <button onClick={handleCancel} className="px-2 py-1 rounded border">
                Annuleren
              </button>
            </>
          )}
          <button onClick={() => onDelete(n.id)} className="px-2 py-1 rounded text-red-600">
            🗑️
          </button>
        </div>
      </div>

      {editing ? (
        <NotitieEditor value={html} onChange={setHtml} editable placeholder="Schrijf je notitie…" />
      ) : (
        <div
          className="p-3 w-full min-h-[8rem] resize-y overflow-auto prose max-w-none text-base"
          style={{ resize: 'vertical' }}
          title={stripHTML(html)}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}

export default function NotitieblokPagina() {
  // Rubrieken ophalen en sorteren
  const {
    data: rubrieken = [],
    mutate: mutateRubrieken,
  } = useSWR<Rubriek[]>('/api/notities', fetcher, {
    revalidateOnMount: true,
    revalidateOnFocus: false,      // belangrijk: geen focus-refresh
    revalidateOnReconnect: false,  // geen reconnect-refresh
  });
  const sortedRubrieken = [...rubrieken].sort((a, b) => a.naam.localeCompare(b.naam));

  const [selRubriek, setSelRubriek] = useState<Rubriek | null>(null);

  const {
    data: notities = [],
    mutate: mutateNotities,
  } = useSWR<Notitie[]>(
    selRubriek ? `/api/notities?rubriek_id=${selRubriek.id}` : null,
    fetcher,
    {
      revalidateOnMount: true,
      revalidateOnFocus: false,      // <<< voorkom “na 1 letter uit edit”
      revalidateOnReconnect: false,  // <<<
      dedupingInterval: 30000,       // minder kans op tussentijdse verversing
    }
  );

  // Nieuwe rubriek
  const [newRubriekName, setNewRubriekName] = useState('');
  const addRubriek = async () => {
    if (!newRubriekName.trim()) return;
    await fetch('/api/notities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ naam: newRubriekName.trim() }),
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
        body: JSON.stringify({ id: r.id, naam: nieuw.trim(), type: 'rubriek' }),
      });
      setSelRubriek((prev) => (prev && prev.id === r.id ? { ...prev, naam: nieuw.trim() } : prev));
      mutateRubrieken();
    }
  };

  const deleteRubriek = async (r: Rubriek) => {
    if (confirm(`Rubriek "${r.naam}" verwijderen?`)) {
      await fetch('/api/notities', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: r.id, type: 'rubriek' }),
      });
      if (selRubriek?.id === r.id) setSelRubriek(null);
      mutateRubrieken();
    }
  };

  // Nieuwe notitie (nu óók Tiptap)
  const [newNotitieHtml, setNewNotitieHtml] = useState('');

  useEffect(() => {
    if (sortedRubrieken.length && !selRubriek) setSelRubriek(sortedRubrieken[0]);
  }, [sortedRubrieken]); // eslint-disable-line react-hooks/exhaustive-deps

  const addNotitie = async () => {
    if (!newNotitieHtml.trim() || !selRubriek) return;
    await fetch('/api/notities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rubriek_id: selRubriek.id, tekst: newNotitieHtml }),
    });
    setNewNotitieHtml('');
    await mutateNotities();
  };

  const deleteNotitie = async (id: number) => {
    if (!confirm('Notitie verwijderen?')) return;
    await fetch('/api/notities', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, type: 'notitie' }),
    });
    mutateNotities();
  };

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Rubriekenlijst */}
      <div className="col-span-1 space-y-2">
        <h2 className="text-lg font-semibold">Rubrieken</h2>
        {sortedRubrieken.map((r) => (
          <div key={r.id} className="flex items-center justify-between px-2 py-1 border rounded">
            <button
              onClick={() => setSelRubriek(r)}
              className={`flex-1 text-left ${selRubriek?.id === r.id ? 'font-semibold' : ''}`}
            >
              {r.naam}
            </button>
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
            onChange={(e) => setNewRubriekName(e.target.value)}
          />
          <button onClick={addRubriek} className="bg-blue-500 text-white px-3 py-1 rounded">+</button>
        </div>
      </div>

      {/* Notities */}
      <div className="col-span-2">
        <h2 className="text-lg font-semibold mb-2">Notities voor “{selRubriek?.naam}”</h2>
        <div className="space-y-4">
          {notities.map((n) => (
            <NotitieRow key={n.id} n={n} onSaved={mutateNotities} onDelete={deleteNotitie} />
          ))}
        </div>

        {/* Nieuwe notitie */}
        <div className="mt-6">
          <div className="flex items-center gap-2 bg-gray-50 border rounded-t px-2 py-1">
            <span className="text-sm text-gray-600">Nieuwe notitie</span>
            <button onClick={addNotitie} className="ml-auto bg-green-600 text-white px-4 py-1 rounded">
              + Notitie
            </button>
          </div>
          <div className="border border-t-0 rounded-b">
            <NotitieEditor
              value={newNotitieHtml}
              onChange={setNewNotitieHtml}
              editable
              placeholder="Schrijf je notitie…"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
