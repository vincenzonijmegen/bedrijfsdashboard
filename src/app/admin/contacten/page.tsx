// src/app/admin/contacten/page.tsx
"use client";

import { useState, useMemo } from 'react';
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
  // Data fetching
  const { data: bedrijven, error, mutate } = useSWR<Company[]>('/api/contacten', fetcher);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [current, setCurrent] = useState<Partial<Company>>({ personen: [] });

  // Loading and error states
  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-red-600">
        Fout bij laden: {error.message}
      </div>
    );
  }
  if (!bedrijven) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        Laden...
      </div>
    );
  }

  // Template for new company
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

  // Styles per rubriek

  const { data: bedrijven, error, mutate } = useSWR<Company[]>('/api/contacten', fetcher);

  // Loading and error states
  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-red-600">
        Fout bij laden: {error.message}
      </div>
    );
  }
  if (!bedrijven) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        Laden...
      </div>
    );
  }

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [current, setCurrent] = useState<Partial<Company>>({ personen: [] });

  // Template for new company
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

  // Styles per rubriek
  const rubriekStyles: Record<string, string> = {
    'leverancier artikelen': 'bg-sky-100 text-sky-800 p-2 rounded',
    'leverancier diensten': 'bg-cyan-100 text-cyan-800 p-2 rounded',
    financieel: 'bg-green-100 text-green-800 p-2 rounded',
    overheid: 'bg-orange-100 text-orange-800 p-2 rounded',
    overig: 'bg-gray-100 text-gray-800 p-2 rounded'
  };

  // Group and sort companies by rubriek
  const grouped = useMemo(() => {
    const map: Record<string, Company[]> = {};
    bedrijven.forEach(c => {
      const key = (c.rubriek || 'overig').toLowerCase();
      if (!map[key]) map[key] = [];
      map[key].push(c);
    });
    Object.keys(map).forEach(r => {
      map[r].sort((a, b) => a.naam.localeCompare(b.naam));
    });
    return map;
  }, [bedrijven]);

  // Fixed rubriek order
  const rubriekOrder = [
    'leverancier artikelen',
    'leverancier diensten',
    'financieel',
    'overheid',
    'overig'
  ];
  const rubrieken = rubriekOrder.filter(r => grouped[r]?.length > 0);

  // Handlers
  const openModal = (company?: Company) => {
    setCurrent(company ? { ...company } : { ...emptyCompany });
    setModalOpen(true);
  };

  const save = async () => {
    const method = current.id ? 'PUT' : 'POST';
    await fetch('/api/contacten', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(current)
    });
    mutate();
    setModalOpen(false);
  };

  const remove = async (id: number) => {
    if (!confirm('Weet je zeker dat je dit bedrijf wilt verwijderen?')) return;
    await fetch(`/api/contacten?id=${id}`, { method: 'DELETE' });
    mutate();
  };

  // Update helpers
  const updateField = <K extends keyof Company>(key: K, value: Company[K]) => {
    setCurrent(prev => ({ ...prev, [key]: value }));
  };

  const updatePersoon = (i: number, key: keyof Contactpersoon, value: string) => {
    setCurrent(prev => ({
      ...prev,
      personen: prev.personen?.map((p, idx) => (idx === i ? { ...p, [key]: value } : p))
    }));
  };

  const addPersoon = () => {
    setCurrent(prev => ({
      ...prev,
      personen: [...(prev.personen || []), { naam: '', telefoon: '', email: '' }]
    }));
  };

  const deletePersoon = (i: number) => {
    setCurrent(prev => ({
      ...prev,
      personen: prev.personen?.filter((_, idx) => idx !== i)
    }));
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold flex items-center space-x-2">
          <Users className="w-6 h-6" />
          <span>Contacten</span>
        </h1>
        <button
          onClick={() => openModal()}
          className="flex items-center bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          <UserPlus className="w-5 h-5 mr-1" />Nieuw bedrijf
        </button>
      </div>

      {/* Rubriek Sections */}
      {rubrieken.map(r => (
        <section key={r} className="mb-8">
          <h2 className={`${rubriekStyles[r]} text-xl font-semibold mb-4`}>{r}</h2>
          <div className="space-y-4">
            {grouped[r].map(c => (
              <div key={c.id} className="p-4 border rounded shadow">
                {/* Company Info */}
                <div className="flex justify-between items-start">
                  <strong className="text-lg">{c.naam}</strong>
                  <div className="space-x-2">
                    <button
                      onClick={() => openModal(c)}
                      className="px-2 py-1 border rounded hover:bg-gray-100"
                    >
                      Bewerk
                    </button>
                    <button
                      onClick={() => remove(c.id)}
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
                      <Building />
                      <span>{c.bedrijfsnaam}</span>
                    </div>
                  )}
                  <div className="flex items-center space-x-2">
                    <Tag />
                    <span>Type: {c.type}</span>
                  </div>
                  {c.debiteurennummer && (
                    <div className="flex items-center space-x-2">
                      <Hash />
                      <span>{c.debiteurennummer}</span>
                    </div>
                  )}
                  {c.rubriek && (
                    <div className="flex items-center space-x-2">
                      <List />
                      <span>{c.rubriek}</span>
                    </div>
                  )}
                  {c.telefoon && (
                    <div className="flex items-center space-x-2">
                      <Phone />
                      <span>{c.telefoon}</span>
                    </div>
                  )}
                  {c.email && (
                    <div className="flex items-center space-x-2">
                      <Mail />
                      <span>{c.email}</span>
                    </div>
                  )}
                  {c.website && (
                    <div className="flex items-center space-x-2">
                      <Globe />
                      <a href={c.website} target="_blank" rel="noreferrer" className="underline">
                        {c.website}
                      </a>
                    </div>
                  )}
                  {c.opmerking && <div className="italic">{c.opmerking}</div>}
                </div>
                {/* Contactpersonen */}
                <div className="mt-3">
                  <h3 className="font-semibold">Contactpersonen</h3>
                  <ul className="list-disc list-inside text-sm mt-1">
                    {c.personen.map((p, idx) => (
                      <li key={idx} className="flex items-center space-x-2">
                        <span>{p.naam}</span>
                        {p.telefoon && (<><Phone /><span>{p.telefoon}</span></>)}
                        {p.email && (<><Mail /><span>{p.email}</span></>)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-2xl overflow-y-auto max-h-full">
            <h2 className="text-xl font-semibold mb-4">
              {current.id ? 'Bewerk bedrijf' : 'Nieuw bedrijf'}
            </h2>
            <form onSubmit={e => { e.preventDefault(); save(); }} className="space-y-4">
              <div className="flex flex-col"><label>Naam</label><input type="text" className="border rounded px-2 py-1" value={current.naam||''} onChange={e=>updateField('naam',e.target.value)} /></div>
              <div className="flex flex-col"><label>Bedrijfsnaam</label><input type="text" className="border rounded px-2 py-1" value={current.bedrijfsnaam||''} onChange={e=>updateField('bedrijfsnaam',e.target.value)} /></div>
              <div className="flex flex-col"><label>Type</label><select className="border rounded px-2 py-1" value={current.type||''} onChange={e=>updateField('type',e.target.value)}><option value="">Selecteer type</option><option value="leverancier artikelen">Leverancier artikelen</option><option value="leverancier diensten">Leverancier diensten</option><option value="financieel">Financieel</option><option value="overheid">Overheid</option><option value="overig">Overig</option></select></div>
              <div className="flex flex-col"><label>Debiteurennummer</label><input type="text" className="border rounded px-2 py-1" value={current.debiteurennummer||''} onChange={e=>updateField('debiteurennummer',e.target.value)} /></div>
              <div className="flex flex-col"><label>Rubriek</label><input type="text" className="border rounded px-2 py-1" value={current.rubriek||''} onChange={e=>updateField('rubriek',e.target.value)} /></div>
              <div className="flex flex-col"><label>Telefoon</label><input type="text" className="border rounded px-2 py-1" value={current.telefoon||''} onChange={e=>updateField('telefoon',e.target.value)} /></div>
              <div className="flex flex-col"><label>Email</label><input type="text" className="border rounded px-2 py-1" value={current.email||''} onChange={e=>updateField('email',e.target.value)} /></div>
              <div className="flex flex-col"><label>Website</label><input type="text" className="border rounded px-2 py-1" value={current.website||''} onChange={e=>updateField('website',e.target.value)} /></div>
              <div className="flex flex-col"><label>Opmerking</label><textarea className="border rounded px-2 py-1" rows={3} value={current.opmerking||''} onChange={e=>updateField('opmerking',e.target.value)} /></div>
              <div>
                <h3 className="font-medium">Contactpersonen</h3>
                {(current.personen||[]).map((p,idx)=>(
                  <div key={idx} className="flex space-x-2 items-center mb-2">
                    <input className="border px-2 py-1 flex-1" placeholder="Naam" value={p.naam} onChange={e=>updatePersoon(idx,'naam',e.target.value)} />
                    <input className="border px-2 py-1" placeholder="Telefoon" value={p.telefoon} onChange={e=>updatePersoon(idx,'telefoon',e.target.value)} />
                    <input className="border px-2 py-1" placeholder="Email" value={p.email} onChange={e=>updatePersoon(idx,'email',e.target.value)} />
                    <button type="button" onClick={()=>deletePersoon(idx)} className="px-2 py-1 bg-red-500 text-white rounded">-</button>
                  </div>
                ))}
                <button type="button" onClick={addPersoon} className="px-3 py-1 bg-green-600 text-white rounded flex items-center space-x-1"><UserPlus className="w-4 h-4"/><span>Persoon toevoegen</span></button>
              </div>
              <div className="flex justify-end space-x-2 pt-4"><button type="button" onClick={()=>setModalOpen(false)} className="px-4 py-2 border rounded hover:bg-gray-100">Annuleer</button><button type="submit" className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">{current.id?'Opslaan':'Toevoegen'}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
