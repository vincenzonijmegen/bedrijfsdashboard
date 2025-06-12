"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";

type Medewerker = {
  id: number;
  naam: string;
  email: string;
  functie: string;
};

export default function MedewerkersBeheer() {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  const isAdmin = email === "herman@ijssalonvincenzo.nl";

  const [naam, setNaam] = useState("");
  const [functie, setFunctie] = useState("");
  const [adres, setAdres] = useState("");
  const [lijst, setLijst] = useState<Medewerker[]>([]);

  useEffect(() => {
    fetch("/api/medewerkers").then(res => res.json()).then(setLijst);
  }, []);

  const toevoegen = async () => {
    const res = await fetch("/api/medewerkers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ naam, functie, email: adres })
    });
    if (res.ok) {
      setNaam(""); setFunctie(""); setAdres("");
      const nieuwe = await res.json();
      setLijst(prev => [...prev, nieuwe]);
    }
  };

  if (!isAdmin) return null;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Medewerkersbeheer</h1>

      <div className="space-y-2">
        <input value={naam} onChange={e => setNaam(e.target.value)} placeholder="Naam" className="w-full border p-2 rounded" />
        <input value={adres} onChange={e => setAdres(e.target.value)} placeholder="E-mailadres" className="w-full border p-2 rounded" />
        <input value={functie} onChange={e => setFunctie(e.target.value)} placeholder="Functie" className="w-full border p-2 rounded" />
        <button onClick={toevoegen} className="bg-green-600 text-white px-4 py-2 rounded">Toevoegen</button>
      </div>

      <table className="w-full table-auto border mt-6">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2">Naam</th>
            <th className="border p-2">E-mailadres</th>
            <th className="border p-2">Functie</th>
          </tr>
        </thead>
        <tbody>
          {lijst.map((m, i) => (
            <tr key={i} className="border-t">
              <td className="p-2">{m.naam}</td>
              <td className="p-2">{m.email}</td>
              <td className="p-2">{m.functie}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
