// src/app/admin/contacten/page.tsx
"use client";

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import {
  Phone,
  Mail,
  Globe,
  Users,
  UserPlus,
  Building,
  Tag,
  Hash,
  List,
} from 'lucide-react';

// Interfaces
interface Contactpersoon {
  id?: number;
  naam: string;
  telefoon?: string;
  email?: string;
}

type Correspondentie = {
  id: number;
  contact_id: number;
  datum: string;
  type: string;
  omschrijving: string;
  bijlage_url?: string;
};

export interface Company {
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

type CompanyInput = Omit<Company, 'id'>;

// Fetcher
const fetcher = (url: string) =>
  fetch(url).then(res => {
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
  });

export default function ContactenPage() {
  // Data hooks
  const { data: bedrijven, error, mutate: mutateBedrijven } = useSWR<Company[]>('/api/contacten', fetcher);
  const { data: correspondenties, mutate: mutateCorrespondentie } = useSWR<Correspondentie[]>('/api/contacten/correspondentie', fetcher);

  // State for contacts
  const [modalOpen, setModalOpen] = useState(false);
  const emptyCompany: CompanyInput = useMemo(
    () => ({ naam: '', bedrijfsnaam: '', type: '', debiteurennummer: '', rubriek: '', telefoon: '', email: '', website: '', opmerking: '', personen: [{ naam: '', telefoon: '', email: '' }] }),
    []
  );
  const [current, setCurrent] = useState<CompanyInput>({ ...emptyCompany });

  // State for search
  const [zoekterm, setZoekterm] = useState('');

  // State for correspondence
  const [corrModalOpen, setCorrModalOpen] = useState(false);
  const [corrForm, setCorrForm] = useState<Partial<Correspondentie>>({
    contact_id: 0,
    datum: new Date().toISOString().slice(0, 10),
    type: '',
    omschrijving: '',
    bijlage_url: '',
  });

  // PDF Upload handler
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', { method: 'POST', body: formData });
    if (res.ok) {
      const data = await res.json();
      setCorrForm(f => ({ ...f, bijlage_url: data.url }));
    }
  };

  // Company CRUD handlers
  const openNew = () => { setCurrent({ ...emptyCompany }); setModalOpen(true); };
  const openEdit = (c: Company) => { const { id, ...rest } = c; setCurrent(rest); setModalOpen(true); };
  const saveCompany = async () => {
    const method = (current as any).id ? 'PUT' : 'POST';
    await fetch('/api/contacten', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(current) });
    mutateBedrijven();
    setModalOpen(false);
  };
  const removeCompany = async (id: number) => {
    if (!confirm('Weet je zeker dat je dit bedrijf wilt verwijderen?')) return;
    await fetch(`/api/contacten?id=${id}`, { method: 'DELETE' });
    mutateBedrijven();
  };
  const updateField = (field: keyof CompanyInput, value: string) => setCurrent(p => ({ ...p, [field]: value }));
  const updatePersoon = (idx: number, field: keyof Contactpersoon, value: string) => setCurrent(p => ({ ...p, personen: p.personen.map((x, i) => i === idx ? { ...x, [field]: value } : x) }));
  const addPersoon = () => setCurrent(p => ({ ...p, personen: [...p.personen, { naam: '', telefoon: '', email: '' }] }));
  const deletePersoon = (idx: number) => setCurrent(p => ({ ...p, personen: p.personen.filter((_, i) => i !== idx) }));

  // Sorting and filtering companies
  const typeOrder = ['leverancier artikelen', 'leverancier diensten', 'financieel', 'overheid', 'overig'];
  const gesorteerd = useMemo(() => {
    if (!bedrijven) return [];
    return bedrijven
      .filter(b => (`${b.naam} ${b.bedrijfsnaam}`).toLowerCase().includes(zoekterm.toLowerCase()))
      .sort((a, b) => {
        const iA = typeOrder.indexOf(a.type);
        const iB = typeOrder.indexOf(b.type);
        if (iA !== iB) return iA - iB;
        return a.naam.localeCompare(b.naam);
      });
  }, [bedrijven, zoekterm]);

  if (error) {
    return <div className="p-6 max-w-4xl mx-auto text-red-600">Fout bij laden: {error.message}</div>;
  }
  if (!bedrijven) {
    return <div className="p-6 max-w-4xl mx-auto">Laden...</div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Search */}
      <input
        type="text"
        placeholder="Zoek..."
        className="mb-4 w-full border px-3 py-2 rounded"
        value={zoekterm}
        onChange={e => setZoekterm(e.target.value)}
      />

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center space-x-2">
          <Users className="w-6 h-6" />
          <span>Contacten</span>
        </h1>
        <button
          onClick={openNew}
          className="flex items-center bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          <UserPlus className="w-5 h-5 mr-1" />
          Nieuw bedrijf
        </button>
      </div>

      {/* Company List */}
      <div className="space-y-4">
        {gesorteerd.reduce<React.ReactNode[]>((acc, c, idx, arr) => {
          const prevType = idx > 0 ? arr[idx - 1].type : null;
          if (c.type !== prevType) {
            acc.push(
              <h2
                key={`header-${c.type}`}
                className="text-xl font-semibold pt-6 px-2 py-2 rounded text-white flex items-center h-10 bg-gray-800"
              >
                {c.type}
              </h2>
            );
          }
          acc.push(
            <div key={c.id} className="p-4 border rounded shadow">
              {/* Company Info */}
              <div className="flex justify-between items-start">
                <strong className="text-lg">{c.naam}</strong>
                <div className="space-x-2">
                  <button
                    onClick={() => openEdit(c)}
                    className="px-2 py-1 border rounded hover:bg-gray-100"
                  >
                    Bewerk
                  </button>
                  <button
                    onClick={() => removeCompany(c.id)}
                    className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Verwijder
                  </button>
                </div>
              </div>
              {/* Details */}
              <div className="mt-2 space-y-2 text-sm">
                {c.bedrijfsnaam && (
                  <div className="flex items-center space-x-2">
                    <Building /> <span>{c.bedrijfsnaam}</span>
                  </div>
                )}
                <div className="flex items-center space-x-2">
                  <Tag /> <span>Type: {c.type}</span>
                </div>
                {c.debiteurennummer && (
                  <div className="flex items-center space-x-2">
                    <Hash /> <span>{c.debiteurennummer}</span>
                  </div>
                )}
                {c.rubriek && (
                  <div className="flex items-center space-x-2">
                    <List /> <span>{c.rubriek}</span>
                  </div>
                )}
                {c.telefoon && (
                  <div className="flex items-center space-x-2">
                    <Phone /> <span>{c.telefoon}</span>
                  </div>
                )}
                {c.email && (
                  <div className="flex items-center space-x-2">
                    <Mail /> <span>{c.email}</span>
                  </div>
                )}
                {c.website && (
                  <div className="flex items-center space-x-2">
                    <Globe />{' '}
                    <a href={c.website} target="_blank" rel="noreferrer" className="underline">
                      {c.website}
                    </a>
                  </div>
                )}
                {c.opmerking && <div className="italic">{c.opmerking}</div>}
              </div>
              {/* Correspondence */}
              <div className="mt-6">
                <h3 className="font-semibold flex items-center gap-2">📎 Correspondentie</h3>
                <ul className="list-disc list-inside text-sm mt-1 italic text-gray-700">
                  {correspondenties
                    ?.filter(item => item.contact_id === c.id)
                    .map(item => (
                      <li key={item.id} className="flex items-center space-x-2">
                        <span>
                          {item.datum} – {item.type} – {item.omschrijving}
                        </span>
                        {item.bijlage_url && (
                          <a href={item.bijlage_url} target="_blank" className="underline ml-2">
                            PDF
                          </a>
                        )}
                      </li>
                    ))}
                </ul>
                <button
                  onClick={() => {
                    setCorrForm({ ...corrForm, contact_id: c.id });
                    setCorrModalOpen(true);
                  }}
                  className="mt-2 text-blue-600 hover:underline text-sm"
                >
                  + Correspondentie toevoegen
                </button>
              </div>
              {/* Contactpersonen */}
              <div className="mt-3">
                <h3 className="font-semibold flex items-center gap-2">
                  <Users /> Contactpersonen
                </h3>
                <ul className="list-disc list-inside text-sm mt-1">
                  {c.personen.map((p, idx) => (
                    <li key={idx} className="flex items-center space-x-2">
                      <span>{p.naam}</span>
                      {p.telefoon && (
                        <><Phone /><span>{p.telefoon}</span></>
                      )}
                      {p.email && (
                        <><Mail /><span>{p.email}</span></>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          );
          return acc;
        }, [])}
      </div>

      {/* Scroll to top button */}
      {typeof window !== 'undefined' && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 left-6 z-50 text-3xl hover:scale-110 transition-transform"
          title="Scroll naar boven"
        >
          ⬆️
        </button>
      )}

      {/* Company Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-2xl overflow-y-auto max-h-full">
            <h2 className="text-xl font-semibold mb-4">{(current as any).id ? 'Bewerk bedrijf' : 'Nieuw bedrijf'}</h2>
            <form onSubmit={e => { e.preventDefault(); saveCompany(); }} className="space-y-4">
              {/* Form fields for company */}
              <div className="flex flex-col">
                <label className="font-medium">Naam</label>
                <input
                  type="text"
                  className="border px-2 py-1 rounded"
                  value={current.naam}
                  onChange={e => updateField('naam', e.target.value)}
                />
              </div>
              <div className="flex flex-col">
                <label className="font-medium">Bedrijfsnaam</label>
                <input
                  type="text"
                  className="border px-2 py-1 rounded"
                  value={current.bedrijfsnaam || ''}
                  onChange={e => updateField('bedrijfsnaam', e.target.value)}
                />
              </div>
              {/* Other form fields... */}
              <div className="flex justify-end space-x-2 pt-4">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border rounded hover:bg-gray-100">Annuleer</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Opslaan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Correspondence Modal */}
      {corrModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md overflow-y-auto max-h-full">
            <h2 className="text-xl font-semibold mb-4">Nieuwe correspondentie</h2>
            <form onSubmit={async e => { e.preventDefault(); await fetch('/api/contacten/correspondentie', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corrForm) }); mutateCorrespondentie(); setCorrModalOpen(false); }} className="space-y-4">
              <div className="flex flex-col">
                <label className="font-medium">Datum</label>
                <input type="date" className="border px-2 py-1 rounded" value={corrForm.datum} onChange={e => setCorrForm(f => ({ ...f, datum: e.target.value }))} />
              </div>
              <div className="flex flex-col">
                <label className="font-medium">Type</label>
                <select className="border px-2 py-1 rounded" value={corrForm.type} onChange={e => setCorrForm(f => ({ ...f, type: e.target.value }))}>
                  <option value="">Selecteer type</option>
                  <option value="email">E-mail</option>
                  <option value="telefoon">Telefoon</option>
                  <option value="bezoek">Bezoek</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label className="font-medium">Omschrijving</label>
                <textarea className="border px-2 py-1 rounded" rows={4} value={corrForm.omschrijving} onChange={e => setCorrForm(f => ({ ...f, omschrijving: e.target.value }))} />
              </div>
              <div className="flex flex-col">
                <label className="font-medium">PDF bijlage</label>
                <input type="file" accept="application/pdf" onChange={handleFileChange} className="border px-2 py-1 rounded" />
                {corrForm.bijlage_url && (
                  <span className="text-sm text-green-600">
                    PDF geüpload: <a href={corrForm.bijlage_url} target="_blank" className="underline">Bekijk</a>
                  </span>
                )}
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <button type="button" onClick={() => setCorrModalOpen(false)} className="px-4 py-2 border rounded hover:bg-gray-100">Annuleer</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">Opslaan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
