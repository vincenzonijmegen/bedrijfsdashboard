// src/app/admin/leveranciers/page.tsx
"use client";

import { useState } from "react";
import useSWR from "swr";
import { Plus, Pencil, Trash } from "lucide-react";

interface Leverancier {
  id: number;
  naam: string;
  soort: string;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function LeveranciersPage() {
  const { data: leveranciers, mutate } = useSWR<Leverancier[]>("/api/leveranciers", fetcher);
  const [modalOpen, setModalOpen] = useState(false);
  const [bewerkt, setBewerkt] = useState<Partial<Leverancier>>({ naam: "", soort: "" });

  const openNieuw = () => {
    setBewerkt({ naam: "", soort: "" });
    setModalOpen(true);
  };

  const openBewerk = (l: Leverancier) => {
    setBewerkt(l);
    setModalOpen(true);
  };

  const opslaan = async () => {
    const method = bewerkt.id ? "PUT" : "POST";
    await fetch("/api/leveranciers", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bewerkt)
    });
    mutate();
    setModalOpen(false);
  };

  const verwijderen = async (id: number) => {
    if (confirm("Weet je zeker dat je deze leverancier wilt verwijderen?")) {
      await fetch(`/api/leveranciers?id=${id}`, { method: "DELETE" });
      mutate();
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Leveranciers</h1>
        <button onClick={openNieuw} className="bg-blue-600 text-white px-4 py-2 rounded flex items-center space-x-2">
          <Plus className="w-4 h-4" />
          <span>Nieuw</span>
        </button>
      </div>

      <table className="w-full table-auto border">
        <thead className="bg-gray-100">
          <tr>
            <th className="text-left px-3 py-2">Naam</th>
            <th className="text-left px-3 py-2">Soort</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {leveranciers?.map(l => (
            <tr key={l.id} className="border-t">
              <td className="px-3 py-2">{l.naam}</td>
              <td className="px-3 py-2 capitalize">{l.soort}</td>
              <td className="px-3 py-2 text-right space-x-2">
                <button onClick={() => openBewerk(l)} className="text-blue-600 hover:underline">
                  <Pencil className="w-4 h-4 inline" />
                </button>
                <button onClick={() => verwijderen(l.id)} className="text-red-600 hover:underline">
                  <Trash className="w-4 h-4 inline" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded shadow w-full max-w-md">
            <h2 className="text-xl font-semibold mb-4">{bewerkt.id ? "Bewerk leverancier" : "Nieuwe leverancier"}</h2>
            <form
              onSubmit={e => {
                e.preventDefault();
                opslaan();
              }}
              className="space-y-4"
            >
              <div className="flex flex-col">
                <label className="font-medium">Naam</label>
                <input
                  type="text"
                  className="border px-2 py-1 rounded"
                  value={bewerkt.naam || ""}
                  onChange={e => setBewerkt({ ...bewerkt, naam: e.target.value })}
                />
              </div>
              <div className="flex flex-col">
                <label className="font-medium">Soort</label>
                <select
                  className="border px-2 py-1 rounded"
                  value={bewerkt.soort || ""}
                  onChange={e => setBewerkt({ ...bewerkt, soort: e.target.value })}
                >
                  <option value="">Selecteer soort</option>
                  <option value="wekelijks">Wekelijks</option>
                  <option value="incidenteel">Incidenteel</option>
                </select>
              </div>
              <div className="flex justify-end space-x-2">
                <button type="button" onClick={() => setModalOpen(false)} className="px-4 py-2 border rounded">Annuleer</button>
                <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded">Opslaan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
