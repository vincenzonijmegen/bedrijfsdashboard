"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
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
} from "lucide-react";

/** Interfaces **/
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

// For form/state purposes, allow omitting `id`
type CompanyInput = Omit<Company, 'id'>;

/** Fetcher **/
const fetcher = (url: string) =>
  fetch(url).then(res => {
    if (!res.ok) throw new Error(res.statusText);
    return res.json();
  });

export default function ContactenPage() {
  /** Data Fetching **/
  const {
    data: bedrijven,
    error,
    mutate,
  } = useSWR<Company[]>('/api/contacten', fetcher);

  /** Modal State **/
  const emptyCompany: CompanyInput = {
    naam: '',
    bedrijfsnaam: '',
    type: '',
    debiteurennummer: '',
    rubriek: '',
    telefoon: '',
    email: '',
    website: '',
    opmerking: '',
    personen: [{ naam: '', telefoon: '', email: '' }],
  };

  const [modalOpen, setModalOpen] = useState(false);
  const [current, setCurrent] = useState<CompanyInput>({ ...emptyCompany });

  /** Styles per rubriek **/
  const rubriekStyles: Record<string, string> = {
    'leverancier artikelen': 'bg-sky-100 text-sky-800 p-2 rounded',
    'leverancier diensten': 'bg-cyan-100 text-cyan-800 p-2 rounded',
    financieel: 'bg-green-100 text-green-800 p-2 rounded',
    overheid: 'bg-orange-100 text-orange-800 p-2 rounded',
    overig: 'bg-gray-100 text-gray-800 p-2 rounded',
  };

  /** Group and sort companies by rubriek **/
  const grouped = useMemo(() => {
    return (bedrijven || []).reduce<Record<string, Company[]>>((map, c) => {
      const key = (c.rubriek || 'overig').toLowerCase();
      if (!map[key]) map[key] = [];
      map[key].push(c);
      return map;
    }, {});
  }, [bedrijven]);

  Object.keys(grouped).forEach(r => {
    grouped[r].sort((a, b) => a.naam.localeCompare(b.naam));
  });

  const rubriekOrder = [
    'leverancier artikelen',
    'leverancier diensten',
    'financieel',
    'overheid',
    'overig',
  ];
  const rubrieken = rubriekOrder.filter(r => grouped[r]?.length > 0);

  if (error) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-red-600">
        Fout bij laden: {error.message}
      </div>
    );
  }
  if (!bedrijven) {
    return (
      <div className="p-6 max-w-4xl mx-auto">Laden...</div>
    );
  }

  /** Handlers **/
  const openModal = (company?: Company) => {
    if (company) {
      const { id, ...rest } = company;
      setCurrent(rest);
    } else {
      setCurrent({ ...emptyCompany });
    }
    setModalOpen(true);
  };

  const save = async () => {
    const method = 'id' in current && (current as any).id ? 'PUT' : 'POST';
    await fetch('/api/contacten', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(current),
    });
    mutate();
    setModalOpen(false);
  };

  const remove = async (id: number) => {
    if (!confirm('Weet je zeker dat je dit bedrijf wilt verwijderen?')) return;
    await fetch(`/api/contacten?id=${id}`, { method: 'DELETE' });
    mutate();
  };

  const updateField = (
    field: keyof CompanyInput,
    value: string
  ) => setCurrent(prev => ({ ...prev, [field]: value }));

  const updatePersoon = (
    idx: number,
    field: keyof Contactpersoon,
    value: string
  ) =>
    setCurrent(prev => ({
      ...prev,
      personen: prev.personen.map((p, i) =>
        i === idx ? { ...p, [field]: value } : p
      ),
    }));

  const addPersoon = () =>
    setCurrent(prev => ({
      ...prev,
      personen: [
        ...prev.personen,
        { naam: '', telefoon: '', email: '' },
      ],
    }));

  const deletePersoon = (idx: number) =>
    setCurrent(prev => ({
      ...prev,
      personen: prev.personen.filter((_, i) => i !== idx),
    }));

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
          type="button"
        >
          <UserPlus className="w-5 h-5 mr-1" />
          Nieuw bedrijf
        </button>
      </div>

      {/* Rubriek Sections */}
      {rubrieken.map(r => (
        <section key={r} className="mb-8">
          <h2
            className={`${rubriekStyles[r]} text-xl font-semibold mb-4`}
          >{r}</h2>
          <div className="space-y-4">
            {grouped[r].map(c => (
              <div
                key={c.id}
                className="p-4 border rounded shadow"
              >
                {/* Company Info */}
                <div className="flex justify-between items-start">
                  <strong className="text-lg">{c.naam}</strong>
                  <div className="space-x-2">
                    <button
                      onClick={() => openModal(c)}
                      className="px-2 py-1 border rounded hover:bg-gray-100"
                      type="button"
                    >
                      Bewerk
                    </button>
                    <button
                      onClick={() => remove(c.id)}
                      className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                      type="button"
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
                      <a
                        href={c.website}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
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
                        {p.telefoon && (
                          <>
                            <Phone />
                            <span>{p.telefoon}</span>
                          </>
                        )}
                        {p.email && (
                          <>
                            <Mail />
                            <span>{p.email}</span>
                          </>
                        )}
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
              {('id' in current ? 'Bewerk bedrijf' : 'Nieuw bedrijf')}
            </h2>
            <form
              onSubmit={e => {
                e.preventDefault();
                save();
              }}
              className="space-y-4"
            >
              {/* Form fields... (same as above) */}
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
