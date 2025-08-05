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
const CollapsibleGroup = ({ title, colorClass, children }: { title: string; colorClass: string; children: React.ReactNode }) => {
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
      {open && <div className="space-y-4 p-4 bg-white">{children}</div>}
    </div>
  );
};

export default function ContactenPage() {
  const { data: bedrijven, mutate } = useSWR<Company[]>('/api/contacten', fetcher);
  const { data: correspondentie, mutate: mutateCorr } = useSWR<Correspondentie[]>('/api/contacten/correspondentie', fetcher);
  const { showSnackbar } = useSnackbar();

  const emptyCompany: CompanyInput = useMemo(
    () => ({
      naam: '', bedrijfsnaam: '', type: '', debiteurennummer: '', rubriek: '', telefoon: '', email: '', website: '', opmerking: '',
      personen: [{ naam: '', telefoon: '', email: '' }],
    }),
    []
  );

  // State
  const [current, setCurrent] = useState<CompanyInput>({ ...emptyCompany });
  const [modalOpen, setModalOpen] = useState(false);
  const [corrModalOpen, setCorrModalOpen] = useState(false);
  const [zoekterm, setZoekterm] = useState('');
  const [corrForm, setCorrForm] = useState({ contact_id: 0, datum: new Date().toISOString().slice(0, 10), type: '', omschrijving: '', bijlage_url: '' });

  // Handlers
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
  const openEdit = (c: Company) => { const { id, ...rest } = c; setCurrent({ ...rest, id } as any); setModalOpen(true); };
  const save = async () => {
    const method = (current as any).id ? 'PUT' : 'POST';
    const url = '/api/contacten' + ((current as any).id ? `?id=${(current as any).id}` : '');
    await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(current) });
    mutate();
    setModalOpen(false);
  };
  const remove = async (id: number) => { if (!confirm('Weet je zeker dat je dit bedrijf wilt verwijderen?')) return; await fetch(`/api/contacten?id=${id}`, { method: 'DELETE' }); mutate(); };
  const removeCorr = async (id: number) => { if (!confirm('Weet je zeker dat je dit correspondentie-item wilt verwijderen?')) return; await fetch(`/api/contacten/correspondentie?id=${id}`, { method: 'DELETE' }); mutateCorr(); showSnackbar('Correspondentie verwijderd'); };

  const updateField = (field: keyof CompanyInput, value: string) => setCurrent(prev => ({ ...prev, [field]: value }));
  const updatePersoon = (idx: number, field: keyof Contactpersoon, value: string) => setCurrent(prev => ({ ...prev, personen: prev.personen.map((p, i) => (i === idx ? { ...p, [field]: value } : p)) }));
  const addPersoon = () => setCurrent(prev => ({ ...prev, personen: [...prev.personen, { naam: '', telefoon: '', email: '' }] }));
  const deletePersoon = (idx: number) => setCurrent(prev => ({ ...prev, personen: prev.personen.filter((_, i) => i !== idx) }));

  const typeOrder = useMemo(
    () => ['leverancier artikelen', 'leverancier diensten', 'financieel', 'overheid', 'overig'],
    []
  );

  const gesorteerd = useMemo(() => {
    if (!bedrijven) return [];
    return bedrijven
      .filter(b => `${b.naam} ${b.bedrijfsnaam || ''} ${b.type}`.toLowerCase().includes(zoekterm.toLowerCase()))
      .sort((a, b) => {
        const idxA = typeOrder.indexOf(a.type);
        const idxB = typeOrder.indexOf(b.type);
        return idxA !== idxB ? idxA - idxB : a.naam.localeCompare(b.naam);
      });
  }, [bedrijven, zoekterm, typeOrder]);

  return (
    <>
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
            const kleur =
              type === 'leverancier artikelen' ? 'bg-sky-600' :
              type === 'leverancier diensten' ? 'bg-cyan-600' :
              type === 'financieel' ? 'bg-green-600' :
              type === 'overheid' ? 'bg-orange-600' :
              'bg-gray-600';
            const grp = gesorteerd.filter(b => b.type === type);
            if (!grp.length) return null;
            return (
              <CollapsibleGroup key={type} title={type} colorClass={kleur}>
                {grp.map(c => (
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
                      <Tag /><span>Type: {c.type}</span>
                      {c.telefoon && (<><Phone /><span>{c.telefoon}</span></>)}
                      {c.email && (<><Mail /><span>{c.email}</span></>)}
                    </div>
                    <div className="mt-3">
                      <h3 className="font-semibold flex items-center gap-2"><Users /><span>Contactpersonen</span></h3>
                      <ul className="list-disc list-inside text-sm mt-1">
                        {c.personen.map((p, i) => (
                          <li key={i} className="flex items-center space-x-2">
                            <span>{p.naam}</span>
                            {p.telefoon && (<><Phone /><span>{p.telefoon}</span></>)}
                            {p.email && (<><Mail /><span>{p.email}</span></>)}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-6">
                      <h3 className="font-semibold flex items-center gap-2">📎 Correspondentie</h3>
                      <ul className="list-disc list-inside text-sm mt-1 italic text-gray-700">
                        {(correspondentie || [])
                          .filter(item => item.contact_id === c.id)
                          .map(item => (
                            <li key={item.id} className="border-t pt-2 mt-2 flex items-center justify-between">
                              <div className="flex flex-col">
                                <span>{new Date(item.datum).toLocaleDateString('nl-NL')} – {item.type}</span>
                                <span>{item.omschrijving}</span>
                                {item.bijlage_url && (<a href={item.bijlage_url} target="_blank" className="underline ml-2">PDF</a>)}
                              </div>
                              <button onClick={() => removeCorr(item.id)} className="text-red-600 hover:underline text-sm">Verwijder</button>
                            </li>
                          ))}
                      </ul>
                      <button
                        onClick={() => { setCorrForm(f => ({ ...f, contact_id: c.id })); setCorrModalOpen(true); }}
                        className="mt-2 text-blue-600 hover:underline text-sm"
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
      </div>

```jsx
      {/* Modals */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-2xl overflow-y-auto max-h-full">
            {/* Modal for add/edit company */}
            {/* ...form fields... */}
          </div>
        </div>
      )}

      {corrModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow w-full max-w-md">
            {/* Modal for correspondence */}
            {/* ...form fields... */}
          </div>
        </div>
      )}
    </>
  );
}
