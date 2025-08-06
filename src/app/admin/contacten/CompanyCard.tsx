// src/app/admin/contacten/CompanyCard.tsx
"use client";

import React, { useState } from 'react';
import { Building, Tag, Hash, List, Phone, Mail, Globe, Users } from 'lucide-react';
import { Company, Correspondentie } from '@/types/contacten';

interface Props {
  company: Company;
  correspondentie: Correspondentie[];
  onEdit: () => void;
  onDelete: () => void;
  onCorrDelete: () => void;
  onAddCorr: () => void;
  startCollapsed?: boolean;
corrCount?: number;
}

export default function CompanyCard({ company: c, correspondentie, onEdit, onDelete, onCorrDelete, onAddCorr }: Props) {
  const [showCorrespondentie, setShowCorrespondentie] = useState(correspondentie.length > 0);

  async function removeCompany(id: number) {
    if (!confirm('Weet je het zeker?')) return;
    await fetch(`/api/contacten/${id}`, { method: 'DELETE' });
    onDelete();
  }

  async function removeCorrItem(id: number) {
    if (!confirm('Weet je het zeker?')) return;
    await fetch(`/api/contacten/correspondentie/${id}`, { method: 'DELETE' });
    onCorrDelete();
  }

  return (
    <div key={c.id} className="p-4 border rounded shadow">
      <div className="flex justify-between items-start">
        <strong className="text-lg">{c.naam}</strong>
        <div className="space-x-2">
          <button onClick={onEdit} className="px-2 py-1 border rounded hover:bg-gray-100">Bewerk</button>
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

      {c.personen.length > 0 && (
        <div className="mt-2 space-y-2 text-sm">
          <h3 className="font-semibold">Contactpersonen</h3>
          {c.personen.map(p => (
            <div key={p.id ?? p.naam} className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-gray-500" />
              <span>{p.naam}{p.telefoon ? `, ${p.telefoon}` : ''}{p.email ? `, ${p.email}` : ''}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-4">
        <button
          onClick={() => setShowCorrespondentie(v => !v)}
          className="font-semibold text-left w-full text-sm text-blue-700 hover:underline"
        >
          📎 Correspondentie {showCorrespondentie ? 'verbergen' : 'tonen'}
        </button>

        {showCorrespondentie && (
          <ul className="list-disc list-inside text-sm mt-2 italic text-gray-700">
            {correspondentie.map(item => (
              <li key={item.id} className="border-t pt-2 mt-2 flex justify-between items-center">
                <div className="flex flex-col">
                  {item.datum && (
                    <span>{new Date(item.datum).toLocaleDateString('nl-NL')} – {item.type}</span>
                  )}
                  <span>{item.omschrijving}</span>
                  {item.bijlage_url && <a href={item.bijlage_url} target="_blank" rel="noreferrer" className="underline">PDF</a>}
                </div>
                <button
                  onClick={() => {
                    if (item.id !== undefined) removeCorrItem(item.id);
                  }}
                  className="text-red-600 hover:underline text-sm"
                >
                  Verwijder
                </button>
              </li>
            ))}
          </ul>
        )}

        <button onClick={onAddCorr} className="mt-2 text-blue-600 hover:underline text-sm">
          + Correspondentie toevoegen
        </button>
      </div>
    </div>
  );
}
