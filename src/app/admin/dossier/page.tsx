// src/app/admin/dossier/page.tsx

"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Medewerker {
  email: string;
  naam: string;
}

export default function DossierOverzicht() {
  const [email, setEmail] = useState("");
  const [tekst, setTekst] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sollicitatieUrl, setSollicitatieUrl] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { data: opmerkingen, mutate } = useSWR(
    email ? `/api/dossier/opmerkingen?email=${email}` : null,
    fetcher
  );
  const { data: medewerkers } = useSWR<Medewerker[]>("/api/admin/medewerkers", fetcher);

  const geselecteerde = medewerkers?.find((m) => m.email === email);

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

  const uploadBestand = async () => {
    if (!file || !email) {
      alert("Selecteer een medewerker en een bestand");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("email", email);

    const res = await fetch("/api/dossier/upload", {
      method: "POST",
      body: formData
    });

    if (res.ok) {
      const json = await res.json();
      alert("Upload gelukt!");
      setSuccess(true);
      setFile(null);
      setSollicitatieUrl(json.url);
    } else {
      alert("Upload mislukt.");
    }
  };

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (!email) {
      setSollicitatieUrl(null);
      return;
    }
    fetch(`/api/dossier/document?email=${email}`)
      .then((res) => res.json())
      .then((data) => setSollicitatieUrl(data.url || null))
      .catch(() => setSollicitatieUrl(null));
  }, [email]);

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-4">
      <h1 className="text-2xl font-bold mb-4">📁 Personeelsdossier</h1>

      <select
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="border px-2 py-1 w-full"
      >
        <option value="">Selecteer medewerker</option>
        {medewerkers?.map((m) => (
          <option key={m.email} value={m.email}>
            {m.naam}
          </option>
        ))}
      </select>

      {email && (
        <div className="space-y-4">
          <textarea
            placeholder="Nieuwe opmerking"
            value={tekst}
            onChange={(e) => setTekst(e.target.value)}
            rows={3}
            className="w-full border px-2 py-1"
          />

          <button
            onClick={voegToe}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Voeg opmerking toe (met datum)
          </button>

          <hr className="my-4" />

          <h2 className="font-semibold">📄 Geüpload bestand</h2>
          <input
            type="file"
            accept=".pdf,image/*"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            className="block border px-2 py-1"
          />
          <button
            onClick={uploadBestand}
            className="mt-2 bg-green-600 text-white px-4 py-2 rounded"
          >
            Upload bestand
          </button>

          {sollicitatieUrl && (
            <div className="mt-4">
              {sollicitatieUrl.endsWith(".pdf") ? (
                <a
                  href={sollicitatieUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 underline"
                >
                  📥 Bekijk huidig bestand
                </a>
              ) : (
                <img
                  src={sollicitatieUrl}
                  alt="Formulier"
                  className="max-w-full border rounded"
                />
              )}
            </div>
          )}

          {success && <div className="text-green-600">Actie voltooid!</div>}

          <hr />

          <h2 className="font-semibold mt-6">🕒 Tijdlijn</h2>
          <ul className="space-y-2">
            {opmerkingen?.map((r: { tekst: string; datum: string }, i: number) => (
              <li key={i} className="border p-2 rounded bg-gray-50">
                <div className="text-sm text-gray-600">{new Date(r.datum).toLocaleDateString("nl-NL")}</div>
                <div>{r.tekst}</div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
