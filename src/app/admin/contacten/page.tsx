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
    <>
      {/* Main */}
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold flex items-center space-x-2">
            <Users className="w-6 h-6 text-gray-800" />
            <span>Contacten</span>
          </h1>
          <button
            onClick={openNew}
            className="bg-blue-600 text-white px-4 py-2 rounded flex items-center space-x-1 hover:bg-blue-700"
          >
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
            const colorClass =
              type === 'leverancier artikelen' ? 'bg-sky-600' :
              type === 'leverancier diensten' ? 'bg-cyan-600' :
              type === 'financieel' ? 'bg-green-600' :
              type === 'overheid' ? 'bg-orange-600' :
              'bg-gray-600';
            return (
              <CollapsibleGroup key={type} title={type} colorClass={colorClass}>
                {group.map(c => (
                  <div key={c.id} className="p-4 border rounded shadow">
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
                    <CollapsibleGroup title="📎 Correspondentie" colorClass="bg-gray-600">
                      <ul className="list-disc list-inside text-sm mt-1 italic text-gray-700">
                        {(correspondentie || [])
                          .filter(item => item.contact_id === c.id)
                          .map(item => (
                            <li
                              key={item.id}
                              className="border-t pt-2 mt-2 flex justify-between items-center"
                            >
                              <div className="flex flex-col">
                                <span>
                                  {new Date(item.datum).toLocaleDateString(
                                    'nl-NL'
                                  )} – {item.type}
                                </span>
                                <span>{item.omschrijving}</span>
                                {item.bijlage_url && (
                                  <a
                                    href={item.bijlage_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline"
                                  >
                                    PDF
                                  </a>
                                )}
                              </div>
                              <button
                                onClick={() => removeCorrItem(item.id)}
                                className="text-red-600 hover:underline text-sm"
                              >
                                Verwijder
                              </button>
                            </li>
                          ))}
                      </ul>
                      <button
                        onClick={() => {
                          setCorrForm(f => ({ ...f, contact_id: c.id } as any));
                          setCorrModalOpen(true);
                        }}
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
      </div>

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
          <div className="relative bg-white p-6 rounded-lg shadow-lg w-full max-w-md max-h-[80vh] overflow-y-auto">
            <button onClick={() => setCorrModalOpen(false)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700">✕</button>
            <h2 className="text-xl font-semibold mb-4">Nieuwe correspondentie</h2>
            <form
              onSubmit={async e => {
                e.preventDefault();
                await fetch('/api/contacten/correspondentie', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(corrForm),
                });
                mutateCorr();
                setCorrModalOpen(false);
              }}
              className="space-y-4"
            >
              <div className="flex flex-col">
                <label>Datum</label>
                <input
                  type="date"
                  className="border rounded px-2 py-1"
                  value={corrForm.datum}
                  onChange={e => setCorrForm(f => ({ ...f, datum: e.target.value }))}
                />
              </div>
              <div className="flex flex-col">
                <label>Type <span className="text-red-600">*</span></label>
                <select
                  required
                  className="border rounded px-2 py-1"
                  value={corrForm.type}
                  onChange={e => setCorrForm(f => ({ ...f, type: e.target.value }))}
                >
                  <option value="" disabled>Selecteer type</option>
                  <option value="email">E‑mail</option>
                  <option value="telefoon">Telefoon</option>
                  <option value="bezoek">Bezoek</option>
                </select>
              </div>
              <div className="flex flex-col">
                <label>Omschrijving</label>
                <textarea
                  className="border rounded px-2 py-1"
                  rows={3}
                  value={corrForm.omschrijving}
                  onChange={e => setCorrForm(f => ({ ...f, omschrijving: e.target.value }))}
                />
              </div>
              <div className="flex flex-col">
                <label>PDF upload (optioneel)</label>
                <input
                  key={corrForm.contact_id}
                  type="file"
                  accept="application/pdf"
                  onChange={handleFileUpload}
                  className="border rounded px-2 py-1"
                />
                {corrForm.bijlage_url && (
                  <a
                    href={corrForm.bijlage_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-600 underline mt-1 block"
                  >
                    Bekijk geüploade PDF
                  </a>
                )}
              </div>
              <div className="flex justify-end space-x-2 pt-4">
                <button
                  type="button"
                  onClick={() => setCorrModalOpen(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-100"
                >
                  Annuleer
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                >
                  Opslaan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

