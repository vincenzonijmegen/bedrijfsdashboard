// src/app/admin/contacten/CorrespondentieModal.tsx
"use client";

import React, { Dispatch, SetStateAction, useState } from 'react';
import { Correspondentie } from '@/types/contacten';

interface Props {
  open: boolean;
  corrForm: Partial<Correspondentie>;
  setCorrForm: Dispatch<SetStateAction<Partial<Correspondentie>>>;
  onClose: () => void;
  onSave: () => void;
}

export default function CorrespondentieModal({ open, corrForm, setCorrForm, onClose, onSave }: Props) {
  const [uploading, setUploading] = useState(false);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('/api/contacten/upload', { method: 'POST', body: formData });
      const data: { url: string } = await res.json();
      setCorrForm(prev => ({ ...prev, bijlage_url: data.url }));
    } catch (err) {
      console.error('Upload mislukt:', err);
    } finally {
      setUploading(false);
    }
  }

  async function save() {
    if (uploading) return alert('Wacht tot de upload is voltooid.');
    await fetch('/api/contacten/correspondentie', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corrForm),
    });
    onSave();
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="relative bg-white p-6 rounded-lg shadow-lg w-full max-w-md max-h-[80vh] overflow-y-auto">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-500 hover:text-gray-700">✕</button>
        <h2 className="text-xl font-semibold mb-4">Nieuwe correspondentie</h2>
        <form onSubmit={e => { e.preventDefault(); save(); }} className="space-y-4">
          <div className="flex flex-col">
            <label>Datum</label>
            <input
              type="date"
              className="border rounded px-2 py-1"
              value={corrForm.datum || ''}
              onChange={e =>
                setCorrForm(prev => ({
                  ...prev,
                  datum: e.target.value
                }))
              }
            />
          </div>
          <div className="flex flex-col">
            <label>Type <span className="text-red-600">*</span></label>
            <select
              required
              className="border rounded px-2 py-1"
              value={corrForm.type || ''}
              onChange={e =>
                setCorrForm(prev => ({
                  ...prev,
                  type: e.target.value as 'email' | 'telefoon' | 'bezoek'
                }))
              }
            >
              <option value="" disabled>Selecteer type</option>
              <option value="email">E-mail</option>
              <option value="telefoon">Telefoon</option>
              <option value="bezoek">Bezoek</option>
            </select>
          </div>
          <div className="flex flex-col">
            <label>Omschrijving</label>
            <textarea
              className="border rounded px-2 py-1"
              rows={3}
              value={corrForm.omschrijving || ''}
              onChange={e =>
                setCorrForm(prev => ({
                  ...prev,
                  omschrijving: e.target.value
                }))
              }
            />
          </div>
          <div className="flex flex-col">
            <label>PDF upload (optioneel)</label>
            <input
              key={corrForm.contact_id ?? 'file'}
              type="file"
              accept="application/pdf"
              onChange={handleFileUpload}
              className="border rounded px-2 py-1"
              disabled={uploading}
            />
            {uploading && <span className="text-sm text-gray-500 mt-1">Bezig met uploaden...</span>}
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
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded hover:bg-gray-100">Annuleer</button>
            <button type="submit" disabled={uploading} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
              {uploading ? 'Even wachten...' : 'Opslaan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
