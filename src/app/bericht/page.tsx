// ✅ Bestand: src/app/bericht/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface Vraag {
  id: number;
  vraag: string;
  antwoord?: string;
  aangemaakt_op: string;
}
 
export default function BerichtPagina() {
  const router = useRouter();
  const [vraag, setVraag] = useState("");
  const [vragen, setVragen] = useState<Vraag[]>([]);

  useEffect(() => {
    fetch("/api/vragen")
      .then((res) => res.json())
      .then(setVragen);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/vragen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ vraag }),
    });
    if (res.ok) {
      setVraag("");
      const nieuwe = await res.json();
      setVragen((prev) => [nieuwe, ...prev]);
    }
  };

  return (
    <main className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">📩 Vraag aan de leiding</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Textarea
          value={vraag}
          onChange={(e) => setVraag(e.target.value)}
          required
          placeholder="Typ hier je vraag, bijvoorbeeld: 'Mag ik morgen eerder weg?'"
        />
        <Button type="submit">Verstuur vraag</Button>
      </form>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold mt-6">Eerdere vragen</h2>
        {vragen.length === 0 && <p className="text-sm text-gray-500">Nog geen vragen gesteld.</p>}
        <ul className="divide-y divide-gray-200">
          {vragen.map((v) => (
            <li key={v.id} className="py-2">
              <p className="text-sm text-gray-500">🗓️ {new Date(v.aangemaakt_op).toLocaleDateString()}</p>
              <p className="text-base">{v.vraag}</p>
              {v.antwoord && (
                <p className="text-green-700 mt-1">💬 Antwoord: {v.antwoord}</p>
              )}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
