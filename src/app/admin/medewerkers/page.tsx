"use client";




import { useEffect, useState } from "react";
import type { Medewerker } from "@/types/db";



interface FunctieOptie {
  id: number;
  naam: string;
}

export default function MedewerkersBeheer() {
  const [medewerkers, setMedewerkers] = useState<Medewerker[]>([]);
  const [functies, setFuncties] = useState<FunctieOptie[]>([]);
  const [form, setForm] = useState({ naam: "", email: "", functie: "", wachtwoord: "" });
  const [fout, setFout] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);

  useEffect(() => {
    fetch("/api/medewerkers")
      .then((res) => res.json())
      .then((data) => setMedewerkers(data));

    fetch("/api/medewerkers?type=functies")
      .then((res) => res.json())
      .then((data) => setFuncties(data));
  }, [succes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFout(null);
    setSucces(false);

    const res = await fetch("/api/medewerkers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    const data = await res.json();
    if (res.ok) {
      setSucces(true);
      setForm({ naam: "", email: "", functie: "", wachtwoord: "" });
    } else {
      setFout(data.error || "Onbekende fout");
    }
  };

  const handleDelete = async (email: string) => {
    if (!confirm(`Verwijder medewerker met e-mail: ${email}?`)) return;
    await fetch(`/api/medewerkers?email=${encodeURIComponent(email)}`, {
      method: "DELETE",
    });
    setSucces(true);
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">👥 Medewerkersbeheer</h1>

      <form onSubmit={handleSubmit} className="space-y-4 bg-gray-50 p-4 rounded shadow">
        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Naam"
            className="border p-2 rounded"
            value={form.naam}
            onChange={(e) => setForm({ ...form, naam: e.target.value })}
            required
          />
          <input
            type="email"
            placeholder="E-mailadres"
            className="border p-2 rounded"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
          <select
            className="border p-2 rounded"
            value={form.functie}
            onChange={(e) => setForm({ ...form, functie: e.target.value })}
            required
          >
            <option value="">Kies functie</option>
            {functies.map((f) => (
              <option key={f.id} value={f.naam}>{f.naam}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Tijdelijk wachtwoord"
            className="border p-2 rounded"
            value={form.wachtwoord}
            onChange={(e) => setForm({ ...form, wachtwoord: e.target.value })}
            required
          />
        </div>
        <button
          type="submit"
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Medewerker toevoegen
        </button>
        {fout && <p className="text-red-600">❌ {fout}</p>}
        {succes && <p className="text-green-700">✅ Toegevoegd</p>}
      </form>

      <div className="bg-white shadow rounded p-4">
        <h2 className="text-lg font-semibold mb-2">Bestaande medewerkers</h2>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2 text-left">Naam</th>
              <th className="border p-2 text-left">E-mail</th>
              <th className="border p-2 text-left">Functie</th>
              <th className="border p-2 text-center">Actie</th>
            </tr>
          </thead>
          <tbody>
            {medewerkers.map((m, i) => (
              <tr key={i}>
                <td className="border p-2">{m.naam}</td>
                <td className="border p-2">{m.email}</td>
                <td className="border p-2">{m.functie}</td>
                <td className="border p-2 text-center">
                  <button
                    onClick={() => handleDelete(m.email)}
                    className="text-red-600 underline text-sm"
                  >
                    Verwijderen
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}