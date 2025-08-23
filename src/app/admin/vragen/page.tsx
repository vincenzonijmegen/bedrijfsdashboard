// 📄 Bestand: src/app/admin/vragen/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface Vraag {
  id: number;
  vraag: string;
  antwoord?: string;
  aangemaakt_op: string;
  naam: string;
  email: string;
}

export default function AdminVragenPagina() {
  const [vragen, setVragen] = useState<Vraag[] | null>(null);
  const [antwoorden, setAntwoorden] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  async function laadVragen() {
    try {
      const res = await fetch("/api/admin/vragen", { credentials: "include" });
      if (!res.ok) throw new Error("Unauthorized");
      const data = await res.json();
      setVragen(data);
    } catch {
      setVragen(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    laadVragen();

    const interval = setInterval(() => {
      laadVragen();
    }, 10000); // elke 10 seconden (testfase)

    return () => clearInterval(interval);
  }, []);

  const handleBeantwoord = async (id: number) => {
    const antwoord = antwoorden[id]?.trim();
    if (!antwoord) return;

    const res = await fetch(`/api/admin/vragen/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ antwoord }),
      credentials: "include",
    });

    if (res.ok) {
      const updated = await res.json();
      setVragen((prev) =>
        Array.isArray(prev) ? prev.map((v) => (v.id === id ? updated : v)) : prev
      );
    }
  };

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">📥 Binnengekomen vragen</h1>

      {loading ? (
        <p className="text-gray-500">⏳ Bezig met laden...</p>
      ) : !vragen ? (
        <p className="text-sm text-red-600">❌ Fout bij laden of je hebt geen toegang.</p>
      ) : vragen.length === 0 ? (
        <p className="text-sm text-gray-500">Er zijn nog geen vragen gesteld.</p>
      ) : (
        <ul className="space-y-4">
          {vragen.map((v) => (
            <li key={v.id} className="border rounded p-4 shadow bg-white">
              <p className="text-sm text-gray-500">🗓️ {new Date(v.aangemaakt_op).toLocaleString()}</p>
              <p className="text-sm text-gray-600">👤 {v.naam} ({v.email})</p>
              <p className="text-base font-medium mt-2">{v.vraag}</p>
              {v.antwoord ? (
                <p className="mt-2 text-green-700">💬 Antwoord: {v.antwoord}</p>
              ) : (
                <div className="mt-3 space-y-2">
                  <Textarea
                    value={antwoorden[v.id] || ""}
                    onChange={(e) => setAntwoorden({ ...antwoorden, [v.id]: e.target.value })}
                    placeholder="Typ hier je antwoord..."
                    rows={3}
                  />
                  <Button onClick={() => handleBeantwoord(v.id)}>Verzend antwoord</Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
