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

// Collapsible group component
const CollapsibleGroup: React.FC<{ title: string; colorClass: string; children: React.ReactNode }> = ({ title, colorClass, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border rounded shadow">
      <button
        onClick={() => setOpen(!open)}
        className={`${colorClass} w-full text-left px-4 py-2 font-semibold text-white flex justify-between items-center`}
      >
        <span>{title}</span>
        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>
      {open && <div className="bg-white p-4 space-y-4">{children}</div>}
    </div>
  );
};

export default function ContactenPage() {
  const { data: bedrijven, mutate } = useSWR<Company[]>('/api/contacten', fetcher);
  const { data: correspondentie, mutate: mutateCorr } = useSWR<Correspondentie[]>('/api/contacten/correspondentie', fetcher);
  const { showSnackbar } = useSnackbar();

  const emptyCompany: CompanyInput = useMemo(
    () => ({ naam: '', bedrijfsnaam: '', type: '', debiteurennummer: '', rubriek: '', telefoon: '', email: '', website: '', opmerking: '', personen: [{ naam: '', telefoon: '', email: '' }] }),
    []
  );

  const [current, setCurrent] = useState<CompanyInput>(emptyCompany);
  const [modalOpen, setModalOpen] = useState(false);
  const [corrModalOpen, setCorrModalOpen] = useState(false);
  const [zoekterm, setZoekterm] = useState('');
  type CorrForm = Omit<Correspondentie, 'id'>;
  const [corrForm, setCorrForm] = useState<CorrForm>({ contact_id: 0, datum: new Date().toISOString().slice(0, 10), type: '', omschrijving: '', bijlage_url: '' });

  // Handlers
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && corrForm.contact_id) {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('contact_id', String(corrForm.contact_id));
      const res = await fetch('/api/contacten/correspondentie/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const { url } = await res.json();
        setCorrForm(f => ({ ...f, bijlage_url: url }));
        showSnackbar('Upload succesvol');
      } else alert('Upload mislukt');
    }
  };

  const openNew = () => {
    setCurrent(emptyCompany);
    setModalOpen(true);
  };
  const openEdit = (c: Company) => {
    const { id, ...rest } = c;
    setCurrent({ ...rest } as CompanyInput);
    (setCurrent as any)({ ...rest, id });
    setModalOpen(true);
  };
  const saveCompany = async () => {
    const method = (current as any).id ? 'PUT' : 'POST';
    const query = (current as any).id ? `?id=${(current as any).id}` : '';
    await fetch(`/api/contacten${query}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(current) });
    mutate();
    setModalOpen(false);
  };
  const removeCompany = async (id: number) => {
    if (confirm('Weet je zeker dat je dit bedrijf wilt verwijderen?')) {
      await fetch(`/api/contacten?id=${id}`, { method: 'DELETE' });
      mutate();
    }
  };
  const removeCorrItem = async (id: number) => {
    if (confirm('Weet je zeker dat je dit correspondentie-item wilt verwijderen?')) {
      await fetch(`/api/contacten/correspondentie?id=${id}`, { method: 'DELETE' });
      mutateCorr();
      showSnackbar('Correspondentie verwijderd');
    }
  };

  const updateField = (key: keyof CompanyInput, value: string) => setCurrent(prev => ({ ...prev, [key]: value }));
  const updatePersoon = (idx: number, key: keyof Contactpersoon, value: string) => setCurrent(prev => ({
    ...prev,
    personen: prev.personen.map((p, i) => (i === idx ? { ...p, [key]: value } : p)),
  }));
  const addPersoon = () => setCurrent(prev => ({ ...prev, personen: [...prev.personen, { naam: '', telefoon: '', email: '' }] }));
  const deletePersoon = (idx: number) => setCurrent(prev => ({ ...prev, personen: prev.personen.filter((_, i) => i !== idx) }));

  const typeOrder = ['leverancier artikelen', 'leverancier diensten', 'financieel', 'overheid', 'overig'];
  const filteredSorted = useMemo(() => {
    if (!bedrijven) return [];
    return bedrijven
      .filter(b => `${b.naam} ${b.type}`.toLowerCase().includes(zoekterm.toLowerCase()))
      .sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type) || a.naam.localeCompare(b.naam));
  }, [bedrijven, zoekterm]);

  return (
    <>
      {/* Main */}
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold flex items-center space-x-2">
            <Users className="w-6 h-6 text-gray-800" />
            <span>Contacten</span>
          </h1>
          <button onClick={openNew} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center space-x-1 hover:bg-blue-700">
            <UserPlus className="w-5 h-5" />
            <span>Nieuw contact</span>
          </button>
        </div>
        <input
          type="text"
          placeholder="Zoek..."
          className="mb-4 w-full border px-3 py-2 rounded"
          value={zoekterm}
          onChange={e => setZoekterm(e.target.value)}
        />
        <div className="space-y-4">
          {typeOrder.map(type => {
            const group = filteredSorted.filter(c => c.type === type);
            if (!group.length) return null;
            const colorClass = type === 'leverancier artikelen' ? 'bg-sky-600' : type === 'leverancier diensten' ? 'bg-cyan-600' : type === 'financieel' ? 'bg-green-600' : type === 'overheid' ? 'bg-orange-600' : 'bg-gray-600';
            return (
              <CollapsibleGroup key={type} title={type} colorClass={colorClass}>
                {group.map(c => (
                  <div key={c.id} className="p-4 border rounded shadow">
                    {/* Company card content here... */}
                  </div>
                ))}
              </CollapsibleGroup>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
            <button onClick={() => setModalOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700">✕</button>
            <h2 className="text-xl font-semibold mb-4">{(current as any).id ? 'Bewerk bedrijf' : 'Nieuw bedrijf'}</h2>
            <form onSubmit={e => { e.preventDefault(); saveCompany(); }} className="space-y-4">
              <div className="flex flex-col">
                <label>Naam <span className="text-red-600">*</span></label>
                <input required type="text" className="border rounded px-2 py-1" value={current.naam} onChange={e => updateField('naam', e.target.value)} />
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
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Opslaan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {corrModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md max-h-[80vh] overflow-y-auto">
            {/* Correspondentie Modal */}
            <button onClick={() => setCorrModalOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700">✕</button>
            {/* Form fields for correspondence */}
          </div>
        </div>
      )}
    </>
  );
}
