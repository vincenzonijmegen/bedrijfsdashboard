// src/app/admin/dossier/page.tsx

"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Textarea } from "@/components/ui/textarea";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function DossierOverzicht() {
  const [email, setEmail] = useState("");
  const [tekst, setTekst] = useState("");
  const [success, setSuccess] = useState(false);
  const { data, mutate } = useSWR(email ? `/api/dossier/opmerkingen?email=${email}` : null, fetcher);

  const voegToe = async () => {
    if (!email || !tekst.trim()) return;
    await fetch("/api/dossier/opmerkingen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, tekst })
    });
    setTekst("");
    setSuccess(true);
    mutate();
  };

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold mb-4">📁 Personeelsdossier</h1>

      <input
        type="text"
        placeholder="E-mailadres medewerker"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border px-2 py-1 w-full"
      />

      <Textarea
        placeholder="Nieuwe opmerking"
        value={tekst}
        onChange={(e) => setTekst(e.target.value)}
        rows={3}
      />

      <button
        onClick={voegToe}
        className="bg-blue-600 text-white px-4 py-2 rounded"
      >
        Voeg opmerking toe (met datum)
      </button>

      {success && <div className="text-green-600">Opmerking toegevoegd!</div>}

      <hr />

      <h2 className="font-semibold mt-6">🕒 Tijdlijn</h2>
      <ul className="space-y-2">
        {data?.map((r: { tekst: string; datum: string }, i: number) => (
          <li key={i} className="border p-2 rounded bg-gray-50">
            <div className="text-sm text-gray-600">{new Date(r.datum).toLocaleDateString("nl-NL")}</div>
            <div>{r.tekst}</div>
          </li>
        ))}
      </ul>
    </main>
  );
}
