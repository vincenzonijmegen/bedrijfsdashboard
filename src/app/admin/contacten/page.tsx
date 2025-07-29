// src/app/admin/contacten/page.tsx
"use client";

import { useState } from 'react';
import useSWR from 'swr';
import { Phone, Mail, Globe, Users, UserPlus, Building, Tag, Hash, List } from 'lucide-react';

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
  telefoon?: string;
  email?: string;
  website?: string;
  opmerking?: string;
  personen: Contactpersoon[];
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function ContactenPage() {
  const { data: bedrijven, mutate } = useSWR<Company[]>('/api/contacten', fetcher);
  const [modalOpen, setModalOpen] = useState(false);
  const emptyCompany: Omit<Company, 'id'> = {
    naam: '',
    bedrijfsnaam: '',
    type: '',
    debiteurennummer: '',
    rubriek: '',
    telefoon: '',
    email: '',
    website: '',
    opmerking: '',
    personen: [{ naam: '', telefoon: '', email: '' }]
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
    if (!window.confirm('Weet je zeker dat je dit bedrijf wilt verwijderen?')) return;
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

  const gesorteerd = bedrijven?.slice().sort((a, b) => a.type.localeCompare(b.type));

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold flex items-center space-x-2">
          <Users className="w-6 h-6 text-gray-800" />
          <span>Belangrijke Gegevens</span>
        </h1>
        <button onClick={openNew} className="flex items-center space-x-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          <UserPlus className="w-5 h-5" />
          <span>Nieuw bedrijf</span>
        </button>
      </div>
      <div className="space-y-4">
        {gesorteerd?.reduce((acc, c, idx, arr) => {
          const prevType = idx > 0 ? arr[idx - 1].type : null;
          const showHeader = c.type !== prevType;
          if (showHeader) {
            acc.push(
              <h2 key={`header-${c.type}`} className="text-xl font-semibold text-gray-700 pt-6">
                {c.type || 'Onbekend type'}
              </h2>
            );
          }
          acc.push(
          <div key={c.id} className="p-4 border rounded shadow">
            <div className="flex justify-between items-start">
              <strong className="text-lg">{c.naam}</strong>
              <div className="space-x-2">
                <button onClick={() => openEdit(c)} className="px-2 py-1 border rounded hover:bg-gray-100">Bewerk</button>
                <button onClick={() => handleDelete(c.id)} className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700">Verwijder</button>
              </div>
            </div>
            <div className="mt-2 space-y-2 text-sm">
              {c.bedrijfsnaam && (<div className="flex items-center space-x-2"><Building className="w-4 h-4 text-gray-600"/><span>{c.bedrijfsnaam}</span></div>)}
              <div className="flex items-center space-x-2"><Tag className="w-4 h-4 text-gray-600"/><span>Type: {c.type}</span></div>
              {c.debiteurennummer && (<div className="flex items-center space-x-2"><Hash className="w-4 h-4 text-gray-600"/><span>Debiteur #: {c.debiteurennummer}</span></div>)}
              {c.rubriek && (<div className="flex items-center space-x-2"><List className="w-4 h-4 text-gray-600"/><span>Rubriek: {c.rubriek}</span></div>)}
              {c.telefoon && (<div className="flex items-center space-x-2"><Phone className="w-4 h-4 text-gray-600"/><span>{c.telefoon}</span></div>)}
              {c.email && (<div className="flex items-center space-x-2"><Mail className="w-4 h-4 text-gray-600"/><span>{c.email}</span></div>)}
              {c.website && (<div className="flex items-center space-x-2"><Globe className="w-4 h-4 text-gray-600"/><a href={c.website} target="_blank" rel="noreferrer" className="underline">{c.website}</a></div>)}
              {c.opmerking && <div className="italic">{c.opmerking}</div>}
            </div>
            <div className="mt-3">
              <div className="flex items-center space-x-2"><Users className="w-5 h-5 text-gray-700"/><h3 className="font-semibold">Contactpersonen</h3></div>
              <ul className="list-disc list-inside text-sm mt-1">
                {c.personen.map((p, i) => (
                  <li key={i} className="flex items-center space-x-2">
                    <span>{p.naam}</span>
                    {p.telefoon && (<><Phone className="w-4 h-4 text-gray-500"/><span>{p.telefoon}</span></>)}
                    {p.email && (<><Mail className="w-4 h-4 text-gray-500"/><span>{p.email}</span></>)}
                  </li>
                ))}
              </ul>
            </div>
          </div>);
        return acc;
      }, [])}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-2xl overflow-y-auto max-h-full">
            <h2 className="text-xl font-semibold mb-4">{bewerkt.id ? 'Bewerk bedrijf' : 'Nieuw bedrijf'}</h2>
            <form onSubmit={e => { e.preventDefault(); handleSave(); }} className="space-y-4">
              {/* Form fields */}
              <div className="flex flex-col">
                <label className="font-medium">Naam</label>
                <input type="text" className="w-full border rounded px-2 py-1" value={bewerkt.naam || ''} onChange={e => setBewerkt({ ...bewerkt, naam: e.target.value })} />
              </div>
              <div className="flex flex-col">
                <label className="font-medium">Bedrijfsnaam</label>
                <input type="text" className="w-full border rounded px-2 py-1" value={bewerkt.bedrijfsnaam || ''} onChange={e => setBewerkt({ ...bewerkt, bedrijfsnaam: e.target.value })} />
              </div>
              <div className="flex flex-col">
                <label className="font-medium">Type</label>
                <select className="w-full border rounded px-2 py-1" value={bewerkt.type || ''} onChange={e => setBewerkt({ ...bewerkt, type: e.target.value })}>
                  <option value="">Selecteer type</option>
                  <option value="leverancier artikelen">Leverancier artikelen</option>
                  <option value="leverancier diensten">Leverancier diensten</option>
                  <option value="financieel">Financieel</option>
                  <option value="overheid">Overheid</option>
                  <option value="overig">Overig</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="font-medium">Debiteurennummer</label>
                <input type="text" className="w-full border rounded px-2 py-1" value={bewerkt.debiteurennummer || ''} onChange={e => setBewerkt({ ...bewerkt, debiteurennummer: e.target.value })} />
              </div>
              <div className="flex flex-col">
                <label className="font-medium">Rubriek</label>
                <input type="text" className="w-full border rounded px-2 py-1" value={bewerkt.rubriek || ''} onChange={e => setBewerkt({ ...bewerkt, rubriek: e.target.value })} />
              </div>
              <div className="flex flex-col">
                <label className="font-medium">Telefoon</label>
                <input type="text" className="w-full border rounded px-2 py-1" value={bewerkt.telefoon || ''} onChange={e => setBewerkt({ ...bewerkt, telefoon: e.target.value })} />
              </div>
              <div className="flex flex-col">
                <label className="font-medium">Email</label>
                <input type="text" className="w-full border rounded px-2 py-1" value={bewerkt.email || ''} onChange={e => setBewerkt({ ...bewerkt, email: e.target.value })} />
              </div>
              <div className="flex flex-col">
                <label className="font-medium">Website</label>
                <input type="text" className="w-full border rounded px-2 py-1" value={bewerkt.website || ''} onChange={e => setBewerkt({ ...bewerkt, website: e.target.value })} />
              </div>
              <div className="flex flex-col">
                <label className="font-medium">Opmerking</label>
                <textarea className="w-full border rounded px-2 py-1" rows={3} value={bewerkt.opmerking || ''} onChange={e => setBewerkt({ ...bewerkt, opmerking: e.target.value })} />
              </div>
              <div>
                <h3 className="font-medium">Contactpersonen</h3>
                {(bewerkt.personen || []).map((p, idx) => (
                  <div key={idx} className="flex space-x-2 items-center mb-2">
                    <input className="border px-2 py-1 flex-1" placeholder="Naam" value={p.naam} onChange={e => updatePersoon(idx, 'naam', e.target.value)} />
                    <input className="border px-2 py-1" placeholder="Telefoon" value={p.telefoon} onChange={e => updatePersoon(idx, 'telefoon', e.target.value)} />
                    <input className="border px-2 py-1" placeholder="Email" value={p.email} onChange={e => updatePersoon(idx, 'email', e.target.value)} />
                    <button type="button" onClick={() => removePersoon(idx)} className="px-2 py-1 bg-red-500 text-white rounded">-</button>
                  </div>
                ))}
                <button type="button" onClick={addPersoon} className="px-3 py-1 bg-green-600 text-white rounded flex items-center space-x-1">
                  <UserPlus className="w-4 h-4" />
                  <span>Persoon toevoegen</span>
                </button>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
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
