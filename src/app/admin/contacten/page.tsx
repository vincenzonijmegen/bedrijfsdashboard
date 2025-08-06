// Bestand opgesplitst: dit is alleen nog de hoofdcomponent
"use client";

import React, { useState, useMemo, useEffect } from 'react';
import useSWR from 'swr';
import { Users, UserPlus, ChevronUp } from 'lucide-react';
import { useSnackbar } from '@/lib/useSnackbar';
import { Company, Correspondentie } from '@/types/contacten';
import {
  CollapsibleGroup,
  CompanyCard,
  CompanyModal,
  CorrespondentieModal,
} from '@/app/admin/contacten';

const fetcher = (url: string) => fetch(url).then(res => {
  if (!res.ok) throw new Error(res.statusText);
  return res.json();
});

export default function AdminContactenPage() {
  const { data: bedrijven = [], mutate: mutateBedrijven } = useSWR<Company[]>('/api/contacten', fetcher);
  const { data: correspondentie = [], mutate: mutateCorr } = useSWR<Correspondentie[]>('/api/contacten/correspondentie', fetcher);
  const { showSnackbar } = useSnackbar();

  const [zoekterm, setZoekterm] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [corrModalOpen, setCorrModalOpen] = useState(false);
  const [current, setCurrent] = useState<Partial<Company>>({ personen: [] });
  const [corrForm, setCorrForm] = useState<Partial<Correspondentie>>({ datum: '', type: undefined, omschrijving: '' });

  const typeOrder = useMemo(() => [
    'leverancier artikelen',
    'leverancier diensten',
    'financieel',
    'overheid',
  ], []);

  const kleurPerType: Record<string, string> = {
    'leverancier artikelen': 'bg-green-600',
    'leverancier diensten': 'bg-orange-500',
    'financieel': 'bg-blue-600',
    'overheid': 'bg-purple-600',
  };

  const filteredSorted = useMemo(
    () => bedrijven
      .filter(c => c.naam.toLowerCase().includes(zoekterm.toLowerCase()))
      .sort((a, b) => typeOrder.indexOf(a.type) - typeOrder.indexOf(b.type)),
    [bedrijven, zoekterm, typeOrder]
  );

  function openNew() {
    setCurrent({ naam: '', type: '', personen: [] });
    setModalOpen(true);
  }

  function openEdit(c: Company) {
    setCurrent(c);
    setModalOpen(true);
  }

  async function handleDeleteContact(id: number) {
    if (!confirm('Weet je zeker dat je dit contact wilt verwijderen?')) return;
    await fetch(`/api/contacten?id=${id}`, { method: 'DELETE' });
    mutateBedrijven();
  }

  function handleAddCorr(contactId: number | undefined) {
    if (typeof contactId !== 'number') return;
    setCorrForm({ datum: '', type: undefined, omschrijving: '', contact_id: contactId });
    setCorrModalOpen(true);
  }

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <>
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
            return (
              <CollapsibleGroup
                key={type}
                title={type}
                colorClass={kleurPerType[type] || 'bg-gray-600'}
              >
                {group.map(c => {
                  const corrItems = correspondentie.filter(item => item.contact_id === c.id);
                  return (
                    <CompanyCard
                      key={c.id}
                      company={c}
                      correspondentie={corrItems}
                      onEdit={() => openEdit(c)}
                      onDelete={() => handleDeleteContact(c.id)}
                      onCorrDelete={mutateCorr}
                      onAddCorr={() => handleAddCorr(c.id)}
                      startCollapsed={true}
                      corrCount={corrItems.length}
                    />
                  );
                })}
              </CollapsibleGroup>
            );
          })}
        </div>
        <div className="fixed bottom-6 right-6 z-50">
          <button onClick={scrollToTop} className="bg-gray-800 text-white p-2 rounded-full shadow-lg hover:bg-gray-700">
            <ChevronUp className="w-5 h-5" />
          </button>
        </div>
      </div>

      <CompanyModal
        open={modalOpen}
        current={current}
        setCurrent={setCurrent}
        onClose={() => setModalOpen(false)}
        onSave={mutateBedrijven}
      />

      <CorrespondentieModal
        open={corrModalOpen}
        corrForm={corrForm}
        setCorrForm={setCorrForm}
        onClose={() => setCorrModalOpen(false)}
        onSave={mutateCorr}
        contactId={corrForm.contact_id!}
      />
    </>
  );
}
