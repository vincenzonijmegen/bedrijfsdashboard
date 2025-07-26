// src/app/admin/contacten/page.tsx
"use client";

import { useEffect, useState } from 'react';
import useSWR from 'swr';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
  Textarea
} from '@/components/ui';

interface Contact {
  id: number;
  naam: string;
  type: string;
  telefoon?: string;
  email?: string;
  website?: string;
  opmerking?: string;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function ContactenPage() {
  const { data: contacten, mutate } = useSWR<Contact[]>('/api/contacten', fetcher);
  const [modalOpen, setModalOpen] = useState(false);
  const [bewerkt, setBewerkt] = useState<Partial<Contact> | null>(null);

  const handleSave = async () => {
    const method = bewerkt?.id ? 'PUT' : 'POST';
    const res = await fetch('/api/contacten', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bewerkt)
    });
    if (res.ok) {
      mutate();
      setModalOpen(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Weet je zeker dat je dit contact wilt verwijderen?')) return;
    await fetch(`/api/contacten?id=${id}`, { method: 'DELETE' });
    mutate();
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">📘 Belangrijke Gegevens</h1>
        <Button onClick={() => { setBewerkt({}); setModalOpen(true); }}>Nieuw</Button>
      </div>

      <div className="grid gap-2">
        {contacten?.map((c) => (
          <div key={c.id} className="p-3 border rounded shadow flex justify-between items-start">
            <div>
              <strong>{c.naam}</strong> <span className="text-sm text-gray-500">({c.type})</span><br />
              {c.telefoon && <div>📞 {c.telefoon}</div>}
              {c.email && <div>✉️ {c.email}</div>}
              {c.website && <div>🔗 <a href={c.website} target="_blank" className="text-blue-600 underline">{c.website}</a></div>}
              {c.opmerking && <div className="italic text-sm mt-1">{c.opmerking}</div>}
            </div>
            <div className="flex flex-col items-end gap-2">
              <Button size="sm" variant="outline" onClick={() => { setBewerkt(c); setModalOpen(true); }}>Bewerk</Button>
              <Button size="sm" variant="destructive" onClick={() => handleDelete(c.id)}>Verwijder</Button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{bewerkt?.id ? 'Bewerk contact' : 'Nieuw contact'}</DialogTitle>
          </DialogHeader>

          <div className="grid gap-2 py-2">
            <Label>Naam</Label>
            <Input value={bewerkt?.naam || ''} onChange={(e) => setBewerkt({ ...bewerkt!, naam: e.target.value })} />
            <Label>Type</Label>
            <Input value={bewerkt?.type || ''} onChange={(e) => setBewerkt({ ...bewerkt!, type: e.target.value })} />
            <Label>Telefoon</Label>
            <Input value={bewerkt?.telefoon || ''} onChange={(e) => setBewerkt({ ...bewerkt!, telefoon: e.target.value })} />
            <Label>Email</Label>
            <Input value={bewerkt?.email || ''} onChange={(e) => setBewerkt({ ...bewerkt!, email: e.target.value })} />
            <Label>Website</Label>
            <Input value={bewerkt?.website || ''} onChange={(e) => setBewerkt({ ...bewerkt!, website: e.target.value })} />
            <Label>Opmerking</Label>
            <Textarea value={bewerkt?.opmerking || ''} onChange={(e) => setBewerkt({ ...bewerkt!, opmerking: e.target.value })} />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)}>Annuleer</Button>
            <Button onClick={handleSave}>{bewerkt?.id ? 'Opslaan' : 'Toevoegen'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
