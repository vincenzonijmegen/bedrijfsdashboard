// src/app/admin/contacten/CompanyModal.tsx
"use client";

import React, { Dispatch, SetStateAction } from 'react';
import { UserPlus } from 'lucide-react';
import { Company, Contactpersoon } from '@/types/contacten';

interface Props {
  open: boolean;
  current: Partial<Company>;
  setCurrent: Dispatch<SetStateAction<Partial<Company>>>;
  onClose: () => void;
  onSave: () => void;
}

export default function CompanyModal({ open, current, setCurrent, onClose, onSave }: Props) {
  function updateField<K extends keyof Company>(field: K, value: Company[K]) {
    setCurrent(prev => ({ ...prev, [field]: value }));
  }

  function updatePersoon(index: number, field: keyof Contactpersoon, value: string) {
    const personen = current.personen ?? [];
    const newPers = [...personen];
    newPers[index] = { ...newPers[index], [field]: value };
    setCurrent(prev => ({ ...prev, personen: newPers }));
  }

  function deletePersoon(index: number) {
    const personen = current.personen ?? [];
    setCurrent(prev => ({ ...prev, personen: personen.filter((_, i) => i !== index) }));
  }

  function addPersoon() {
    const personen = current.personen ?? [];
    setCurrent(prev => ({ ...prev, personen: [...personen, { naam: '', telefoon: '', email: '' }] }));
  }

async function save() {
  const method = current.id ? 'PUT' : 'POST';
const url = `/api/contacten`;

  await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(current),
  });

  onSave();
  onClose();
}


  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700">✕</button>
        <h2 className="text-xl font-semibold mb-4">{current.id ? 'Bewerk bedrijf' : 'Nieuw bedrijf'}</h2>
        <form onSubmit={e => { e.preventDefault(); save(); }} className="space-y-4">
          <div className="flex flex-col">
            <label>Naam <span className="text-red-600">*</span></label>
            <input required type="text" className="border rounded px-2 py-1" value={current.naam || ''} onChange={e => updateField('naam', e.target.value)} />
          </div>
          <div className="flex flex-col">
            <label>Type <span className="text-red-600">*</span></label>
            <select required className="border rounded px-2 py-1" value={current.type || ''} onChange={e => updateField('type', e.target.value as Company['type'])}>
              <option value="" disabled>Selecteer type</option>
              <option value="leverancier artikelen">leverancier artikelen</option>
              <option value="leverancier diensten">leverancier diensten</option>
              <option value="financieel">financieel</option>
              <option value="overheid">overheid</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label>Bedrijfsnaam</label>
            <input type="text" className="border rounded px-2 py-1" value={current.bedrijfsnaam || ''} onChange={e => updateField('bedrijfsnaam', e.target.value)} />
          </div>
          <div className="flex flex-col">
            <label>Debiteurennummer</label>
            <input type="text" className="border rounded px-2 py-1" value={current.debiteurennummer || ''} onChange={e => updateField('debiteurennummer', e.target.value)} />
          </div>
          <div className="flex flex-col">
            <label>Rubriek</label>
            <input type="text" className="border rounded px-2 py-1" value={current.rubriek || ''} onChange={e => updateField('rubriek', e.target.value)} />
          </div>
          <div className="flex flex-col">
            <label>Telefoon</label>
            <input type="text" className="border rounded px-2 py-1" value={current.telefoon || ''} onChange={e => updateField('telefoon', e.target.value)} />
          </div>
          <div className="flex flex-col">
            <label>E-mail</label>
            <input type="email" className="border rounded px-2 py-1" value={current.email || ''} onChange={e => updateField('email', e.target.value)} />
          </div>
          <div className="flex flex-col">
            <label>Website</label>
            <input type="text" className="border rounded px-2 py-1" value={current.website || ''} onChange={e => updateField('website', e.target.value)} />
          </div>
          <div className="flex flex-col">
            <label>Opmerking</label>
            <textarea className="border rounded px-2 py-1" rows={3} value={current.opmerking || ''} onChange={e => updateField('opmerking', e.target.value)} />
          </div>
          <div>
            <h3 className="font-semibold">Contactpersonen</h3>
            {(current.personen ?? []).map((p, i) => (
              <div key={i} className="flex gap-2 items-center mb-2">
                <input type="text" placeholder="Naam" className="border px-2 py-1 flex-1" value={p.naam} onChange={e => updatePersoon(i, 'naam', e.target.value)} />
                <input type="text" placeholder="Telefoon" className="border px-2 py-1 flex-1" value={p.telefoon || ''} onChange={e => updatePersoon(i, 'telefoon', e.target.value)} />
                <input type="email" placeholder="E-mail" className="border px-2 py-1 flex-1" value={p.email || ''} onChange={e => updatePersoon(i, 'email', e.target.value)} />
                <button type="button" onClick={() => deletePersoon(i)} className="px-2 py-1 bg-red-500 text-white rounded">Verwijder</button>
              </div>
            ))}
            <button type="button" onClick={addPersoon} className="px-3 py-1 bg-green-600 text-white rounded flex items-center space-x-1">
              <UserPlus className="w-4 h-4" />
              <span>Persoon toevoegen</span>
            </button>
          </div>
          <div className="flex justify-end space-x-2 pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-100">Annuleer</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Opslaan</button>
          </div>
        </form>
      </div>
    </div>
  );
}
