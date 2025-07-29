// src/app/admin/contacten/page.tsx
"use client";

import { useState } from 'react';
import useSWR from 'swr';

interface Contactpersoon {
  id?: number;
  naam: string;
  telefoon?: string;
  email?: string;
}

interface Company {
  id: number;
  naam: string;
  bedrijfsnaam?: string;
  type: string;
  debiteurennummer?: string;
  rubriek?: string;
  opmerking?: string;
  personen: Contactpersoon[];
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function ContactenPage() {
  const { data: bedrijven, mutate } = useSWR<Company[]>('/api/contacten', fetcher);
  const [modalOpen, setModalOpen] = useState(false);
  const emptyCompany: Omit<Company, 'id'> = {
    naam: '', bedrijfsnaam: '', type: '', debiteurennummer: '', rubriek: '', opmerking: '', personen: [{ naam: '', telefoon: '', email: '' }]
  };
  const [bewerkt, setBewerkt] = useState<Partial<Company>>(emptyCompany);

  const openNew = () => {
    setBewerkt({ ...emptyCompany });
    setModalOpen(true);
  };

  const openEdit = (c: Company) => {
    setBewerkt({ ...c });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const method = bewerkt.id ? 'PUT' : 'POST';
    await fetch('/api/contacten', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bewerkt)
    });
    mutate();
    setModalOpen(false);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Weet je zeker?')) return;
    await fetch(`/api/contacten?id=${id}`, { method: 'DELETE' });
    mutate();
  };

  const updatePersoon = (idx: number, field: keyof Contactpersoon, value: string) => {
    const personen = [...(bewerkt.personen || [])];
    personen[idx] = { ...personen[idx], [field]: value };
    setBewerkt({ ...bewerkt, personen });
  };

  const addPersoon = () => {
    setBewerkt({ ...bewerkt, personen: [...(bewerkt.personen || []), { naam: '', telefoon: '', email: '' }] });
  };

  const removePersoon = (idx: number) => {
    const personen = (bewerkt.personen || []).filter((_, i) => i !== idx);
    setBewerkt({ ...bewerkt, personen });
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between mb-4">
        <h1 className="text-2xl font-bold">📘 Belangrijke Gegevens</h1>
        <button onClick={openNew} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">Nieuw bedrijf</button>
      </div>
      <div className="space-y-4">
        {bedrijven?.map(c => (
          <div key={c.id} className="p-4 border rounded shadow">
            <div className="flex justify-between">
              <strong>{c.naam}</strong>
              <div className="space-x-2">
                <button onClick={() => openEdit(c)} className="px-2 py-1 border rounded">Bewerk</button>
                <button onClick={() => handleDelete(c.id)} className="px-2 py-1 bg-red-600 text-white rounded">Verwijder</button>
              </div>
            </div>
            <div className="mt-2 space-y-1">
              {c.bedrijfsnaam && <div>Bedrijf: {c.bedrijfsnaam}</div>}
              <div>Type: {c.type}</div>
              {c.debiteurennummer && <div>Debiteur #: {c.debiteurennummer}</div>}
              {c.rubriek && <div>Rubriek: {c.rubriek}</div>}
              {c.opmerking && <div>Opmerking: {c.opmerking}</div>}
            </div>
            <div className="mt-3">
              <h3 className="font-semibold">Contactpersonen:</h3>
              <ul className="list-disc list-inside">
                {c.personen.map((p, i) => (
                  <li key={i}>{p.naam}{p.telefoon && ` - ${p.telefoon}`}{p.email && ` - ${p.email}`}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-2xl">
            <h2 className="text-xl mb-4">{bewerkt.id ? 'Bewerk bedrijf' : 'Nieuw bedrijf'}</h2>
            <div className="space-y-3">
              {['naam','bedrijfsnaam','type','debiteurennummer','rubriek','opmerking'].map(key => (
                <div key={key}>
                  <label className="block font-medium capitalize">{key.replace('debiteurennummer','Debiteurennummer')}</label>
                  <input
                    type="text"
                    className="w-full border rounded px-2 py-1"
                    value={(bewerkt as any)[key]||''}
                    onChange={e=>setBewerkt({...bewerkt,[key]:e.target.value})}
                  />
                </div>
              ))}
              <div>
                <h3 className="font-medium">Contactpersonen</h3>
                {(bewerkt.personen||[]).map((p,idx)=>(
                  <div key={idx} className="flex space-x-2 items-center mb-2">
                    <input className="border px-2 py-1 flex-1" placeholder="Naam" value={p.naam} onChange={e=>updatePersoon(idx,'naam',e.target.value)} />
                    <input className="border px-2 py-1" placeholder="Tel" value={p.telefoon} onChange={e=>updatePersoon(idx,'telefoon',e.target.value)} />
                    <input className="border px-2 py-1" placeholder="Email" value={p.email} onChange={e=>updatePersoon(idx,'email',e.target.value)} />
                    <button onClick={()=>removePersoon(idx)} className="px-2 py-1 bg-red-500 text-white rounded">-</button>
                  </div>
                ))}
                <button onClick={addPersoon} className="px-3 py-1 bg-green-600 text-white rounded">+ Persoon</button>
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-2">
              <button onClick={()=>setModalOpen(false)} className="px-4 py-2 border rounded">Annuleer</button>
              <button onClick={handleSave} className="px-4 py-2 bg-green-600 text-white rounded">Opslaan</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
