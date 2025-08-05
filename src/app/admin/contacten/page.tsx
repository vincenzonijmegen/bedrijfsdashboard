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
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface Correspondentie {
  id: number;
  contact_id: number;
  datum: string;
  type: string;
  omschrijving: string;
  bijlage_url?: string;
}

interface Contactpersoon {
  id?: number;
  naam: string;
  telefoon?: string;
  email?: string;
}

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

const fetcher = (url: string) =>
  fetch(url).then(res => {
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
  });

import { useSnackbar } from '@/lib/useSnackbar';

// Component for collapsible groups by type
const CollapsibleGroup = ({
  title,
  colorClass,
  children,
}: {
  title: string;
  colorClass: string;
  children: React.ReactNode;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded shadow">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full text-left px-4 py-2 font-semibold text-white flex justify-between items-center ${colorClass}`}
      >
        <span>{title}</span>
        {open ? <ChevronDown className="w-4 h-4 opacity-80" /> : <ChevronRight className="w-4 h-4 opacity-80" />}
      </button>
      {open && <div className="space-y-4 px-4 py-3 bg-white">{children}</div>}
    </div>
  );
};

export default function ContactenPage() {
  const { data: bedrijven, error, mutate } = useSWR<Company[]>('/api/contacten', fetcher);
  const { data: correspondentie, mutate: mutateCorr } = useSWR<Correspondentie[]>('/api/contacten/correspondentie', fetcher);
  const { showSnackbar } = useSnackbar();

  const emptyCompany: CompanyInput = useMemo(() => ({
    naam: '', bedrijfsnaam: '', type: '', debiteurennummer: '', rubriek: '', telefoon: '', email: '', website: '', opmerking: '',
    personen: [{ naam: '', telefoon: '', email: '' }],
  }), []);

  const [current, setCurrent] = useState<CompanyInput>({ ...emptyCompany });
  const [modalOpen, setModalOpen] = useState(false);
  const [zoekterm, setZoekterm] = useState('');
  const [corrModalOpen, setCorrModalOpen] = useState(false);
  const [corrForm, setCorrForm] = useState({
    contact_id: 0,
    datum: new Date().toISOString().slice(0, 10),
    type: '',
    omschrijving: '',
    bijlage_url: '',
  });

  // File upload for correspondence
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !corrForm.contact_id) return;
    const formData = new FormData();
    formData.append('file', file);
    formData.append('contact_id', corrForm.contact_id.toString());
    const res = await fetch('/api/contacten/correspondentie/upload', { method: 'POST', body: formData });
    if (!res.ok) { alert('Upload mislukt'); return; }
    const { url } = await res.json();
    setCorrForm(f => ({ ...f, bijlage_url: url }));
    showSnackbar('Upload succesvol');
  };

  const openNew = () => { setCurrent({ ...emptyCompany }); setModalOpen(true); };
  const openEdit = (c: Company) => { setCurrent(c); (current as any).id = c.id; setModalOpen(true); };
  const save = async () => {
    const method = (current as any).id ? 'PUT' : 'POST';
    const url = '/api/contacten' + ((current as any).id ? `?id=${(current as any).id}` : '');
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(current) });
    mutate(); setModalOpen(false);
  };
  const remove = async (id: number) => { if (!confirm('Weet je zeker?')) return; await fetch(`/api/contacten?id=${id}`, { method: 'DELETE' }); mutate(); };

  const updateField = (field: keyof CompanyInput, value: string) => setCurrent(prev => ({ ...prev, [field]: value }));
  const updatePersoon = (idx: number, field: keyof Contactpersoon, value: string) => setCurrent(prev => ({
    ...prev,
    personen: prev.personen.map((p,i) => i===idx ? { ...p, [field]: value } : p),
  }));
  const addPersoon = () => setCurrent(prev => ({ ...prev, personen: [...prev.personen, { naam: '', telefoon: '', email: '' }] }));
  const deletePersoon = (idx: number) => setCurrent(prev => ({ ...prev, personen: prev.personen.filter((_,i) => i!==idx) }));
  const removeCorr = async (id: number) => { if (!confirm('Verwijder correspondentie?')) return; await fetch(`/api/contacten/correspondentie?id=${id}`,{method:'DELETE'}); mutateCorr(); showSnackbar('Verwijderd'); };

  const typeOrder = useMemo(() => [
    'leverancier artikelen', 'leverancier diensten', 'financieel', 'overheid', 'overig'
  ], []);

  const gesorteerd = useMemo(() => {
    if (!bedrijven) return [];
    return bedrijven
      .filter(b => {
        const text = `${b.naam} ${b.bedrijfsnaam||''} ${b.type}`.toLowerCase();
        return text.includes(zoekterm.toLowerCase());
      })
      .sort((a,b) => {
        const iA = typeOrder.indexOf(a.type);
        const iB = typeOrder.indexOf(b.type);
        return iA!==iB ? iA-iB : a.naam.localeCompare(b.naam);
      });
  }, [bedrijven, zoekterm, typeOrder]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <input
        type="text"
        placeholder="Zoek..."
        className="mb-4 w-full border px-3 py-2 rounded"
        value={zoekterm}
        onChange={e => setZoekterm(e.target.value)}
      />
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold flex items-center space-x-2">
          <Users className="w-6 h-6 text-gray-800" />
          <span>Contacten</span>
        </h1>
        <button onClick={openNew} className="flex items-center space-x-1 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          <UserPlus className="w-5 h-5" />
          <span>Nieuw contact</span>
        </button>
      </div>
      <div className="space-y-6">
        {typeOrder.map(type => {
          const kleur = type === 'leverancier artikelen'
            ? 'bg-sky-600'
            : type === 'leverancier diensten'
            ? 'bg-cyan-600'
            : type === 'financieel'
            ? 'bg-green-600'
            : type === 'overheid'
            ? 'bg-orange-600'
            : 'bg-gray-600';
          const bedrijvenVanType = gesorteerd.filter(b => b.type === type);
          if (!bedrijvenVanType.length) return null;
          return (
            <CollapsibleGroup key={type} title={type} colorClass={kleur}>
              {bedrijvenVanType.map(c => (
                <div key={c.id} className="p-4 border rounded shadow">
                  <div className="flex justify-between items-start">
                    <strong className="text-lg">{c.naam}</strong>
                    <div className="space-x-2">
                      <button onClick={() => openEdit(c)} className="px-2 py-1 border rounded hover:bg-gray-100">Bewerk</button>
                      <button onClick={() => remove(c.id)} className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700">Verwijder</button>
                    </div>
                  </div>
                  <div className="mt-2 space-y-2 text-sm">
                    {c.bedrijfsnaam && (<div className="flex items-center space-x-2"><Building /><span>{c.bedrijfsnaam}</span></div>)}
                    <div className="flex items-center space-x-2"><Tag /><span>Type: {c.type}</span></div>
                    {c.telefoon && (<div className="flex items-center space-x-2"><Phone /><span>{c.telefoon}</span></div>)}
                    {c.email && (<div className="flex items-center space-x-2"><Mail /><span>{c.email}</span></div>)}
                  </div>
                  <div className="mt-3">
                    <h3 className="font-semibold flex items-center gap-2"><Users/><span>Contactpersonen</span></h3>
                    <ul className="list-disc list-inside text-sm mt-1">
                      {c.personen.map((p, i) => (
                        <li key={i} className="flex items-center space-x-2">
                          <span>{p.naam}</span>
                          {p.telefoon && (<><Phone/><span>{p.telefoon}</span></>)}
                          {p.email && (<><Mail/><span>{p.email}</span></>)}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-6">
                    <h3 className="font-semibold flex items-center gap-2">📎 Correspondentie</h3>
                    <ul className="list-disc list-inside text-sm mt-1 italic text-gray-700">
                      {(correspondentie || []).filter(item => item.contact_id === c.id).map(item => (
                        <li key={item.id} className="border-t pt-2 mt-2 flex items-center justify-between">
                          <div className="flex flex-col">
                            <span>{new Date(item.datum).toLocaleDateString('nl-NL')} – {item.type}</span>
                            <span>{item.omschrijving}</span>
                            {item.bijlage_url && (
                              <a href={item.bijlage_url} target="_blank" className="underline ml-2">PDF</a>
                            )}
                          </div>
                          <button onClick={() => removeCorr(item.id)} className="text-red-600 hover:underline text-sm">Verwijder</button>
                        </li>
                      ))}
                    </ul>
                    <button
                      className="mt-2 text-blue-600 hover:underline text-sm"
                      onClick={() => { setCorrForm(f => ({ ...f, contact_id: c.id })); setCorrModalOpen(true); }}
                    >
                      + Correspondentie toevoegen
                    </button>
                  </div>
                </div>
              ))}
            </CollapsibleGroup>
          );
        })}
      </div>
      {/* Modals */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-2xl overflow-y-auto max-h-full">
            <h2 className="text-xl font-semibold mb-4">{(current as any).id ? 'Bewerk bedrijf' : 'Nieuw bedrijf'}</h2>
            <form onSubmit={e => { e.preventDefault(); save(); }} className="space-y-4">
              {/* Form fields */}
            </form>
          </div>
        </div>
      )}

        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-2xl overflow-y-auto max-h-full">
            <h2 className="text-xl font-semibold mb-4">{(current as any).id ? 'Bewerk bedrijf' : 'Nieuw bedrijf'}</h2>
            <form onSubmit={e => { e.preventDefault(); save(); }} className="space-y-4">
              <div className="flex flex-col">
                <label>Naam</label>
                <input type="text" className="border rounded px-2 py-1" value={current.naam} onChange={e => updateField('naam', e.target.value)} />
              </div>
              <div className="flex flex-col">
                <label>Bedrijfsnaam</label>
                <input type="text" className="border rounded px-2 py-1" value={current.bedrijfsnaam} onChange={e => updateField('bedrijfsnaam', e.target.value)} />
              </div>
              <div className="flex flex-col">
                <label>Type <span className="text-red-600">*</span></label>
                <select required className="border rounded px-2 py-1" value={current.type} onChange={e => updateField('type', e.target.value)}>
                  <option value="" disabled>Selecteer type</option>
                  {typeOrder.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="flex flex-col">
                <label>Debiteurennummer</label>
                <input type="text" className="border rounded px-2 py-1" value={current.debiteurennummer} onChange={e => updateField('debiteurennummer', e.target.value)} />
              </div>
              <div className="flex flex-col">
                <label>Rubriek</label>
                <input type="text" className="border rounded px-2 py-1" value={current.rubriek} onChange={e => updateField('rubriek', e.target.value)} />
              </div>
              <div className="flex flex-col">
                <label>Telefoon</label>
                <input type="text" className="border rounded px-2 py-1" value={current.telefoon} onChange={e => updateField('telefoon', e.target.value)} />
              </div>
              <div className="flex flex-col">
                <label>E-mail</label>
                <input type="email" className="border rounded px-2 py-1" value={current.email} onChange={e => updateField('email', e.target.value)} />
              </div>
              <div className="flex flex-col">
                <label>Website</label>
                <input type="text" className="border rounded px-2 py-1" value={current.website} onChange={e => updateField('website', e.target.value)} />
              </div>
              <div className="flex flex-col">
                <label>Opmerking</label>
                <textarea className="border rounded px-2 py-1" rows={3} value={current.opmerking} onChange={e => updateField('opmerking', e.target.value)} />
              </div>
              <div>
                <h3 className="font-semibold">Contactpersonen</h3>
                {current.personen.map((p, i) => (
                  <div key={i} className="flex gap-2 items-center mb-2">
                    <input type="text" placeholder="Naam" className="border px-2 py-1 flex-1" value={p.naam} onChange={e => updatePersoon(i, 'naam', e.target.value)} />
                    <input type="text" placeholder="Telefoon" className="border px-2 py-1 flex-1" value={p.telefoon} onChange={e => updatePersoon(i, 'telefoon', e.target.value)} />
                    <input type="email" placeholder="E-mail" className="border px-2 py-1 flex-1" value={p.email} onChange={e => updatePersoon(i, 'email', e.target.value)} />
                    <button type="button" onClick={() => deletePersoon(i)} className="px-2 py-1 bg-red-500 text-white rounded">Verwijder</button>
                  </div>
                ))}
                <button type="button" onClick={addPersoon} className="px-3 py-1 bg-green-600 text-white rounded flex items-center space-x-1">
                  <UserPlus className="w-4 h-4" />
                  <span>Persoon toevoegen</span>
                </button>
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border rounded hover:bg-gray-100">Annuleer</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                  Opslaan
                </button>
              </div>
            </form>
          </div>
        </div>
      )
    </div>
  );
}
