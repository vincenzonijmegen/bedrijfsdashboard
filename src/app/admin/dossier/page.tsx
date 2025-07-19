// src/app/admin/dossier

"use client";

import { useState } from "react";
import useSWR from "swr";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

const formatDate = (dateStr: string) => {
  try {
    return format(new Date(dateStr), "d MMMM yyyy", { locale: nl });
  } catch {
    return dateStr;
  }
};



const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Medewerker {
  email: string;
  naam: string;
}

interface Ziekteverzuim {
  id: number;
  van: string;
  tot: string;
  opmerking: string;
}

export default function DossierOverzicht() {
  const [email, setEmail] = useState("");
  const [tekst, setTekst] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [success, setSuccess] = useState(false);
  const [actieveUrl, setActieveUrl] = useState<string | null>(null);
  const [editId, setEditId] = useState<number | null>(null);
  const [editTekst, setEditTekst] = useState("");

  const [van, setVan] = useState("");
  const [tot, setTot] = useState("");
  const [opmerkingZiekte, setOpmerkingZiekte] = useState("");

  const { data: opmerkingen, mutate } = useSWR(
    email ? `/api/dossier/opmerkingen?email=${email}` : null,
    fetcher
  );
  const { data: medewerkers } = useSWR<Medewerker[]>("/api/admin/medewerkers", fetcher);
  const { data: documenten } = useSWR(email ? `/api/dossier/document?email=${email}` : null, fetcher);

  const geselecteerde = medewerkers?.find((m) => m.email === email);
  const { data: verzuim, mutate: mutateVerzuim } = useSWR<Ziekteverzuim[]>(
    geselecteerde ? `/api/medewerkers/${geselecteerde.email}/verzuim` : null,
    fetcher
  );

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
    setTimeout(() => setSuccess(false), 3000);
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
      (document.getElementById("upload") as HTMLInputElement).value = "";
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    }
  };

  const voegZiekteverzuimToe = async () => {
    if (!van || !tot || !geselecteerde) return;
    await fetch(`/api/medewerkers/${geselecteerde.email}/verzuim`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ van, tot, opmerking: opmerkingZiekte })
    });
    setVan("");
    setTot("");
    setOpmerkingZiekte("");
    mutateVerzuim();
  };

  const verwijderZiekteverzuim = async (id: number) => {
    await fetch(`/api/medewerkers/verzuim/${id}`, { method: "DELETE" });
    mutateVerzuim();
  };

  const verwijderOpmerking = async (id: number) => {
    await fetch("/api/dossier/opmerkingen", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id })
    });
    mutate();
  };

  const bewerkOpmerking = async (id: number) => {
    await fetch("/api/dossier/opmerkingen", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, tekst: editTekst })
    });
    setEditId(null);
    setEditTekst("");
    mutate();
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
            {success && <p className="text-green-600 mt-2">Opgeslagen</p>}
          </div>

          <div className="my-4">
            <input id="upload" type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            <button onClick={uploadBestand} className="ml-2 bg-green-500 text-white px-4 py-1 rounded">
              Upload bestand
            </button>
            {success && <p className="text-green-600 mt-2">Upload voltooid</p>}
          </div>

          {/* Ziekteverzuim invoer */}
          <div className="my-6">
            <h2 className="font-semibold mb-2">Ziekteverzuim</h2>
            <div className="flex gap-2 items-center mb-2">
              <input type="date" value={van} onChange={e => setVan(e.target.value)} className="border rounded px-2 py-1" />
              <span>t/m</span>
              <input type="date" value={tot} onChange={e => setTot(e.target.value)} className="border rounded px-2 py-1" />
              <input type="text" value={opmerkingZiekte} onChange={e => setOpmerkingZiekte(e.target.value)} placeholder="Toelichting" className="border rounded px-2 py-1 flex-1" />
              <button onClick={voegZiekteverzuimToe} className="bg-blue-600 text-white px-3 py-1 rounded">➕ Toevoegen</button>
            </div>
            {Array.isArray(verzuim) && verzuim.length > 0 && (
              <ul className="mt-2 space-y-2">
                {verzuim.map((v) => (
<li key={v.id} className="bg-violet-50 border border-violet-200 p-3 rounded-xl shadow-sm relative">
  <p className="text-sm">
    <strong>{formatDate(v.van)}</strong>
    {v.van !== v.tot && (
      <>
        <span> t/m </span>
        <strong>{formatDate(v.tot)}</strong>
      </>
    )}
    <span> – {v.opmerking}</span>
  </p>
  <button
    onClick={() => verwijderZiekteverzuim(v.id)}
    className="absolute right-2 top-2 text-red-500 text-sm"
  >
    🗑️
  </button>
</li>

                ))}
              </ul>
            )}
          </div>

          {/* Documenten */}
          {documenten?.length > 0 && (
            <div className="mt-6">
              <h2 className="font-semibold mb-2">Documenten</h2>
              {documenten.map((doc: { bestand_url: string }, i: number) => (
                <div key={i} className="my-2">
                  <button
                    onClick={() => setActieveUrl(doc.bestand_url)}
                    className="text-blue-600 underline hover:text-blue-800"
                  >
                    📄 Bekijk document
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Opmerkingen */}
          {opmerkingen?.length > 0 && (
            <div className="mt-6">
              <h2 className="font-semibold mb-2">Opmerkingen</h2>
              <div className="space-y-3">
                {opmerkingen.map((o: { id: number; tekst: string; datum: string }, i: number) => (
                  <div key={o.id} className="bg-gray-100 border border-gray-300 p-3 rounded shadow-sm relative">
                    <div className="text-sm text-gray-600 mb-1">
                      {new Date(o.datum).toLocaleDateString("nl-NL", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "2-digit"
                      })}
                    </div>

                    {editId === o.id ? (
                      <>
                        <textarea
                          value={editTekst}
                          onChange={(e) => setEditTekst(e.target.value)}
                          className="w-full border rounded p-1"
                        />
                        <button onClick={() => bewerkOpmerking(o.id)} className="text-green-600 mt-1">💾 Opslaan</button>
                      </>
                    ) : (
                      <div>{o.tekst}</div>
                    )}

                    <div className="absolute top-2 right-2 flex gap-2 text-sm">
                      <button
                        onClick={() => {
                          setEditId(o.id);
                          setEditTekst(o.tekst);
                        }}
                        className="text-blue-600"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => verwijderOpmerking(o.id)}
                        className="text-red-600"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {actieveUrl && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded shadow-lg w-full max-w-3xl h-[80vh] relative">
            <button
              onClick={() => setActieveUrl(null)}
              className="absolute top-2 right-2 text-red-600 font-bold"
            >
              ✕
            </button>
            {actieveUrl.endsWith(".pdf") ? (
              <iframe
                src={`${actieveUrl}?v=${Date.now()}#view=FitH&toolbar=0&navpanes=0&scrollbar=0`}
                className="w-full h-full rounded"
              />
            ) : (
              <img src={actieveUrl} alt="Document" className="max-h-full max-w-full mx-auto" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
