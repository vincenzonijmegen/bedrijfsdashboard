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
  const [success, setSuccess] = useState(false);

  const { data: opmerkingen, mutate } = useSWR(
    email ? `/api/dossier/opmerkingen?email=${email}` : null,
    fetcher
  );
  const { data: medewerkers } = useSWR<Medewerker[]>("/api/admin/medewerkers", fetcher);
  const { data: documenten } = useSWR(email ? `/api/dossier/document?email=${email}` : null, fetcher);

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
      setFile(null);
      setSuccess(true);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Personeelsdossier</h1>

      <label className="block mb-2">
        Kies medewerker:
        <select value={email} onChange={(e) => setEmail(e.target.value)} className="ml-2 border rounded px-2 py-1">
          <option value="">-- Kies --</option>
          {medewerkers?.map((m) => (
            <option key={m.email} value={m.email}>{m.naam}</option>
          ))}
        </select>
      </label>

      {email && (
        <>
          <div className="my-4">
            <textarea
              value={tekst}
              onChange={(e) => setTekst(e.target.value)}
              placeholder="Opmerking toevoegen"
              className="w-full border p-2 rounded"
            />
            <button onClick={voegToe} className="mt-2 bg-blue-500 text-white px-4 py-1 rounded">
              Opslaan
            </button>
          </div>

          <div className="my-4">
            <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <button onClick={uploadBestand} className="ml-2 bg-green-500 text-white px-4 py-1 rounded">
              Upload bestand
            </button>
          </div>

          {documenten?.length > 0 && (
            <div className="mt-6">
              <h2 className="font-semibold mb-2">Documenten</h2>
              {documenten.map((doc: { bestand_url: string }, i: number) => (
                <div key={i} className="my-4">
                  {doc.bestand_url.endsWith(".pdf") ? (
                    <iframe src={doc.bestand_url} className="w-full h-64 rounded border" />
                  ) : (
                    <img src={doc.bestand_url} alt="Document" className="w-32 h-32 object-cover border rounded" />
                  )}
                </div>
              ))}
            </div>
          )}

          {opmerkingen?.length > 0 && (
            <div className="mt-6">
              <h2 className="font-semibold mb-2">Opmerkingen</h2>
              <ul className="list-disc pl-6">
                {opmerkingen.map((o: any, i: number) => (
                  <li key={i}>{o.tekst}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
