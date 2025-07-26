// src/app/admin/contacten/page.tsx
"use client";

import { useState } from 'react';
import useSWR from 'swr';

interface Contact {
  id: number;
  naam: string;
  type: string;
  telefoon?: string;
  email?: string;
  website?: string;
  opmerking?: string;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function ContactenPage() {
  const { data: contacten, mutate } = useSWR<Contact[]>('/api/contacten', fetcher);
  const [modalOpen, setModalOpen] = useState(false);
  const [bewerkt, setBewerkt] = useState<Partial<Contact>>({ naam: '', type: '' });

  const openNew = () => {
    setBewerkt({ naam: '', type: '' });
    setModalOpen(true);
  };

  const openEdit = (c: Contact) => {
    setBewerkt(c);
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
        <button
          onClick={openNew}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition"
        >
          Nieuw
        </button>
      </div>

      <div className="grid gap-3">
        {contacten?.map(c => (
          <div key={c.id} className="p-4 border rounded shadow flex justify-between">
            <div>
              <strong>{c.naam}</strong> <span className="text-sm text-gray-500">({c.type})</span>
              <div className="mt-2 space-y-1 text-sm">
                {c.telefoon && <div>📞 {c.telefoon}</div>}
                {c.email && <div>✉️ {c.email}</div>}
                {c.website && (
                  <div>
                    🔗{' '}
                    <a href={c.website} target="_blank" rel="noreferrer" className="text-blue-600 underline">
                      {c.website}
                    </a>
                  </div>
                )}
                {c.opmerking && <div className="italic">{c.opmerking}</div>}
              </div>
            </div>
            <div className="space-y-2">
              <button
                onClick={() => openEdit(c)}
                className="w-full text-sm border border-gray-300 px-3 py-1 rounded hover:bg-gray-100 transition"
              >
                Bewerk
              </button>
              <button
                onClick={() => handleDelete(c.id)}
                className="w-full text-sm bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 transition"
              >
                Verwijder
              </button>
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
            <div className="space-y-4">
              <div>
                <label className="block font-medium">Naam</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={bewerkt.naam || ''}
                  onChange={e => setBewerkt({ ...bewerkt, naam: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-medium">Type</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={bewerkt.type || ''}
                  onChange={e => setBewerkt({ ...bewerkt, type: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-medium">Telefoon</label>
                <input
                  type="text"
                  className="w-full border rounded px-3 py-2"
                  value={bewerkt.telefoon || ''}
                  onChange={e => setBewerkt({ ...bewerkt, telefoon: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-medium">E-mail</label>
                <input
                  type="email"
                  className="w-full border rounded px-3 py-2"
                  value={bewerkt.email || ''}
                  onChange={e => setBewerkt({ ...bewerkt, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-medium">Website</label>
                <input
                  type="url"
                  className="w-full border rounded px-3 py-2"
                  value={bewerkt.website || ''}
                  onChange={e => setBewerkt({ ...bewerkt, website: e.target.value })}
                />
              </div>
              <div>
                <label className="block font-medium">Opmerking</label>
                <textarea
                  className="w-full border rounded px-3 py-2"
                  rows={3}
                  value={bewerkt.opmerking || ''}
                  onChange={e => setBewerkt({ ...bewerkt, opmerking: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 border rounded hover:bg-gray-100 transition"
              >
                Annuleer
              </button>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
              >
                {bewerkt.id ? 'Opslaan' : 'Toevoegen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
