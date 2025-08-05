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
                    <div className="flex justify-between items-start">
                      <strong className="text-lg">{c.naam}</strong>
                      <div className="space-x-2">
                        <button onClick={() => openEdit(c)} className="px-2 py-1 border rounded hover:bg-gray-100">Bewerk</button>
                        <button onClick={() => removeCompany(c.id)} className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700">Verwijder</button>
                      </div>
                    </div>
                    <div className="mt-2 space-y-2 text-sm">
                      {c.bedrijfsnaam && <div className="flex items-center space-x-2"><Building /><span>{c.bedrijfsnaam}</span></div>}
                      <div className="flex items-center space-x-2"><Tag /><span>Type: {c.type}</span></div>
                      {c.debiteurennummer && <div className="flex items-center space-x-2"><Hash /><span>{c.debiteurennummer}</span></div>}
                      {c.rubriek && <div className="flex items-center space-x-2"><List /><span>{c.rubriek}</span></div>}
                      {c.telefoon && <div className="flex items-center space-x-2"><Phone /><span>{c.telefoon}</span></div>}
                      {c.email && <div className="flex items-center space-x-2"><Mail /><span>{c.email}</span></div>}
                      {c.website && <div className="flex items-center space-x-2"><Globe /><a href={c.website} target="_blank" rel="noreferrer" className="underline">{c.website}</a></div>}
                      {c.opmerking && <div className="italic">{c.opmerking}</div>}
                    </div>
                    <CollapsibleGroup title="📎 Correspondentie" colorClass="bg-gray-600">
                    <ul className="list-disc list-inside text-sm mt-1 italic text-gray-700">
                      {(correspondentie || []).filter(item => item.contact_id === c.id).map(item => (
                        <li key={item.id} className="border-t pt-2 mt-2 flex justify-between items-center">
                          <div className="flex flex-col">
                            <span>{new Date(item.datum).toLocaleDateString('nl-NL')} – {item.type}</span>
                            <span>{item.omschrijving}</span>
                            {item.bijlage_url && <a href={item.bijlage_url} target="_blank" rel="noreferrer" className="underline">PDF</a>}
                          </div>
                          <button onClick={() => removeCorrItem(item.id)} className="text-red-600 hover:underline text-sm">Verwijder</button>
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => { setCorrForm(f => ({ ...f, contact_id: c.id })); setCorrModalOpen(true); }}
                      className="mt-2 text-blue-600 hover:underline text-sm"
                    >
                      + Correspondentie toevoegen
                    </button>
                  </CollapsibleGroup>
                </div>
              ))}
            </CollapsibleGroup>
          );
        })}
      </div>
    </>
  );
}
