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
    const url = '/api/contacten' + (method === 'PUT' && bewerkt.id ? `?id=${bewerkt.id}` : '');
    await fetch(url, {
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
            <div className="space-y-1">
              <div>
                <strong>{c.naam}</strong>{c.bedrijfsnaam && <em> ({c.bedrijfsnaam})</em>}
              </div>
              <div className="text-sm text-gray-500">Type: {c.type}</div>
              {c.debiteurennummer && <div className="text-sm">Debiteur #: {c.debiteurennummer}</div>}
              {c.rubriek && <div className="text-sm">Rubriek: {c.rubriek}</div>}
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
            <div className="space-y-2 flex-shrink-0">
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
            <form className="space-y-4" onSubmit={e => { e.preventDefault(); handleSave(); }}>
              {['naam', 'bedrijfsnaam', 'type', 'debiteurennummer', 'rubriek', 'telefoon', 'email', 'website', 'opmerking'].map(field => (
                <div key={field}>
                  <label className="block font-medium capitalize">{field.replace('debiteurennummer', 'Debiteurennummer').replace('bedrijfsnaam', 'Bedrijfsnaam')}</label>
                  {field !== 'opmerking' ? (
                    <input
                      type={field === 'email' ? 'email' : field === 'website' ? 'url' : 'text'}
                      className="w-full border rounded px-3 py-2"
                      value={(bewerkt as any)[field] || ''}
                      onChange={e => setBewerkt({ ...bewerkt, [field]: e.target.value })}
                    />
                  ) : (
                    <textarea
                      className="w-full border rounded px-3 py-2"
                      rows={3}
                      value={(bewerkt as any)[field] || ''}
                      onChange={e => setBewerkt({ ...bewerkt, [field]: e.target.value })}
                    />
                  )}
                </div>
              ))}
              <div className="mt-6 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-100 transition"
                >
                  Annuleer
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition"
                >
                  {bewerkt.id ? 'Opslaan' : 'Toevoegen'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
