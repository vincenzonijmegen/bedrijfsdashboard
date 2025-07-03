"use client";

import useSWR, { mutate } from "swr";
import { useState } from "react";
import type { Functie, Medewerker } from "@/types/db";

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function MedewerkersPagina() {
  // Haal functies en medewerkers op
  const { data: functies } = useSWR<Functie[]>("/api/medewerkers?type=functies", fetcher);
  const { data: medewerkers } = useSWR<Medewerker[]>("/api/medewerkers", fetcher);

  // State voor nieuw medewerker
  const [naam, setNaam] = useState("");
  const [email, setEmail] = useState("");
  const [nieuwFunctie, setNieuwFunctie] = useState<number | null>(null);

  // Voeg medewerker toe
  const handleAdd = async () => {
    if (!naam || !email) return;
    await fetch("/api/medewerkers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ naam, email, functie: nieuwFunctie }),
    });
    setNaam("");
    setEmail("");
    setNieuwFunctie(null);
    mutate("/api/medewerkers");
  };

  // Update medewerker-functie
  const handleUpdateFunctie = async (id: number, functie_id: number | null) => {
    await fetch("/api/medewerkers", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, functie_id }),
    });
    mutate("/api/medewerkers");
  };

  // Verwijder medewerker
  const handleDelete = async (id: number) => {
    if (!confirm("Weet je zeker dat je deze medewerker wilt verwijderen?")) return;
    await fetch(`/api/medewerkers?id=${id}`, { method: "DELETE" });
    mutate("/api/medewerkers");
  };

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">👥 Medewerkersbeheer</h1>

      {/* Formulier */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <input
          type="text"
          placeholder="Naam"
          className="border px-3 py-2 rounded w-full"
          value={naam}
          onChange={e => setNaam(e.target.value)}
        />
        <input
          type="email"
          placeholder="E-mailadres"
          className="border px-3 py-2 rounded w-full"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />
        <select
          className="border px-3 py-2 rounded w-full"
          value={nieuwFunctie ?? ""}
          onChange={e => setNieuwFunctie(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">Kies functie</option>
          {functies?.map(f => (
            <option key={f.id} value={f.id}>{f.naam}</option>
          ))}
        </select>
        <button
          onClick={handleAdd}
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          ➕ Medewerker toevoegen
        </button>
      </div>

      {/* Tabel */}
      <table className="w-full text-sm border mt-6">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 text-left">Naam</th>
            <th className="p-2 text-left">E-mail</th>
            <th className="p-2 text-left">Functie</th>
            <th className="p-2 text-left">Acties</th>
          </tr>
        </thead>
        <tbody>
          {medewerkers?.map(m => (
            <tr key={m.id} className="border-t">
              <td className="p-2">{m.naam}</td>
              <td className="p-2">{m.email}</td>
              <td className="p-2">
                <select
                  className="border px-2 py-1 rounded w-full"
                  value={m.functie_id ?? ""}
                  onChange={e => handleUpdateFunctie(m.id, e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Geen functie</option>
                  {functies?.map(f => (
                    <option key={f.id} value={f.id}>{f.naam}</option>
                  ))}
                </select>
              </td>
              <td className="p-2 space-x-2">
                <button
                  onClick={() => handleDelete(m.id)}
                  className="text-red-600 hover:underline"
                >
                  Verwijderen
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
