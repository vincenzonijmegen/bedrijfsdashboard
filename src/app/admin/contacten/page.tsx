// src/app/admin/contacten/page.tsx
"use client";

import { useState } from 'react';
import useSWR from 'swr';

interface Contact {
  id: number;
  naam: string;
  bedrijfsnaam?: string;
  type: string;
  debiteurennummer?: string;
  rubriek?: string;
  telefoon?: string;
  email?: string;
  website?: string;
  opmerking?: string;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function ContactenPage() {
  const { data: contacten, mutate } = useSWR<Contact[]>('/api/contacten', fetcher);
  const [modalOpen, setModalOpen] = useState(false);
  const [bewerkt, setBewerkt] = useState<Partial<Contact>>({
    naam: '',
    bedrijfsnaam: '',
    type: '',
    debiteurennummer: '',
    rubriek: '',
    telefoon: '',
    email: '',
    website: '',
    opmerking: ''
  });

  const openNew = () => {
    setBewerkt({
      naam: '',
      bedrijfsnaam: '',
      type: '',
      debiteurennummer: '',
      rubriek: '',
      telefoon: '',
      email: '',
      website: '',
      opmerking: ''
    });
    setModalOpen(true);
  };

  const openEdit = (c: Contact) => {
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
    if (!window.confirm('Weet je zeker dat je dit contact wilt verwijderen?')) return;
    await fetch(`/api/contacten?id=${id}`, { method: 'DELETE' });
    mutate();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">📘 Belangrijke Gegevens</h1>
        <button onClick={openNew} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition">
          Nieuw
        </button>
      </div>

      <div className="grid gap-3">
        {contacten?.map(c => (
          <div key={c.id} className="p-4 border rounded shadow flex justify-between">
            <div className="space-y-1">
              <strong>{c.naam}</strong>
              {c.bedrijfsnaam && <div>Bedrijf: {c.bedrijfsnaam}</div>}
              <div>Type: {c.type}</div>
              {c.debiteurennummer && <div>Debiteur #: {c.debiteurennummer}</div>}
              {c.rubriek && <div>Rubriek: {c.rubriek}</div>}
              {c.telefoon && <div>Telefoon: {c.telefoon}</div>}
              {c.email && <div>Email: {c.email}</div>}
              {c.website && <div>Website: <a href={c.website} target="_blank" className="text-blue-600 underline">{c.website}</a></div>}
              {c.opmerking && <div>Opmerking: {c.opmerking}</div>}
            </div>
            <div className="flex flex-col space-y-2">
              <button onClick={() => openEdit(c)} className="px-3 py-1 border rounded hover:bg-gray-100">Bewerk</button>
              <button onClick={() => handleDelete(c.id!)} className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700">Verwijder</button>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">
              {bewerkt.id ? 'Bewerk contact' : 'Nieuw contact'}
            </h2>
            <form onSubmit={e => { e.preventDefault(); handleSave(); }}>
              <div className="mb-3">
                <label className="block font-medium">Naam</label>
                <input className="w-full border rounded px-2 py-1" value={bewerkt.naam || ''} onChange={e => setBewerkt({ ...bewerkt, naam: e.target.value })} />
              </div>
              <div className="mb-3">
                <label className="block font-medium">Bedrijfsnaam</label>
                <input className="w-full border rounded px-2 py-1" value={bewerkt.bedrijfsnaam || ''} onChange={e => setBewerkt({ ...bewerkt, bedrijfsnaam: e.target.value })} />
              </div>
              <div className="mb-3">
                <label className="block font-medium">Type</label>
                <input className="w-full border rounded px-2 py-1" value={bewerkt.type || ''} onChange={e => setBewerkt({ ...bewerkt, type: e.target.value })} />
              </div>
              <div className="mb-3">
                <label className="block font-medium">Debiteurennummer</label>
                <input className="w-full border rounded px-2 py-1" value={bewerkt.debiteurennummer || ''} onChange={e => setBewerkt({ ...bewerkt, debiteurennummer: e.target.value })} />
              </div>
              <div className="mb-3">
                <label className="block font-medium">Rubriek</label>
                <input className="w-full border rounded px-2 py-1" value={bewerkt.rubriek || ''} onChange={e => setBewerkt({ ...bewerkt, rubriek: e.target.value })} />
              </div>
              <div className="mb-3">
                <label className="block font-medium">Telefoon</label>
                <input className="w-full border rounded px-2 py-1" value={bewerkt.telefoon || ''} onChange={e => setBewerkt({ ...bewerkt, telefoon: e.target.value })} />
              </div>
              <div className="mb-3">
                <label className="block font-medium">Email</label>
                <input className="w-full border rounded px-2 py-1" value={bewerkt.email || ''} onChange={e => setBewerkt({ ...bewerkt, email: e.target.value })} />
              </div>
              <div className="mb-3">
                <label className="block font-medium">Website</label>
                <input className="w-full border rounded px-2 py-1" value={bewerkt.website || ''} onChange={e => setBewerkt({ ...bewerkt, website: e.target.value })} />
              </div>
              <div className="mb-4">
                <label className="block font-medium">Opmerking</label>
                <textarea className="w-full border rounded px-2 py-1" rows={3} value={bewerkt.opmerking || ''} onChange={e => setBewerkt({ ...bewerkt, opmerking: e.target.value })} />
              </div>
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border rounded hover:bg-gray-100">Annuleer</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">{bewerkt.id ? 'Opslaan' : 'Toevoegen'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
