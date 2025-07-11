// Versie zonder drag-and-drop

"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

interface Actie {
  id: number;
  tekst: string;
  voltooid: boolean;
  deadline?: string;
  verantwoordelijke?: string;
  volgorde?: number;
}

interface ActieLijst {
  id: number;
  naam: string;
  icoon: string;
}

export default function ActieLijstPagina() {
  const { data: lijsten, error: lijstError, isLoading: lijstLoading, mutate: mutateLijsten } = useSWR<ActieLijst[]>('/api/actielijsten', fetcher);
  const [geselecteerdeLijst, setGeselecteerdeLijst] = useState<ActieLijst | null>(null);
  const { data: actiesRaw = [], mutate } = useSWR<Actie[]>(
    geselecteerdeLijst ? `/api/acties?lijst_id=${geselecteerdeLijst.id}` : null,
    fetcher
  );
  const [acties, setActies] = useState<Actie[]>([]);
  const [nieuweLijstNaam, setNieuweLijstNaam] = useState("");
  const [nieuweActieTekst, setNieuweActieTekst] = useState("");
  const [lijstEdit, setLijstEdit] = useState<{ id: number; naam: string; icoon: string } | null>(null);
  const [actieEdit, setActieEdit] = useState<{ id: number; tekst: string } | null>(null);

  useEffect(() => {
    if (!actiesRaw) return;
    const openActies = actiesRaw.filter((a) => !a.voltooid);
    setActies(openActies);
  }, [actiesRaw]);

  const toggleActie = async (id: number, voltooid: boolean) => {
    try {
      const nieuwVoltooid = !voltooid;
      const res = await fetch('/api/acties', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, voltooid: nieuwVoltooid })
      });
      if (!res.ok) {
        const fout = await res.text();
        console.error('Fout bij opslaan voltooid-status:', fout);
      } else {
        await mutate();
      }
    } catch (error) {
      console.error('Netwerkfout bij toggleActie:', error);
    }
  };

  const updateActieTekst = async (id: number, tekst: string) => {
    await fetch('/api/acties', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, tekst })
    });
    mutate();
  };

  const nieuweLijstToevoegen = async () => {
    if (!nieuweLijstNaam.trim()) return;
    await fetch('/api/actielijsten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ naam: nieuweLijstNaam.trim(), icoon: "📋" })
    });
    setNieuweLijstNaam("");
    mutateLijsten();
  };

  const lijstVerwijderen = async (id: number) => {
    if (!confirm("Weet je zeker dat je deze lijst wilt verwijderen?")) return;
    await fetch('/api/actielijsten', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    mutateLijsten();
    if (geselecteerdeLijst?.id === id) setGeselecteerdeLijst(null);
  };

  const lijstBijwerken = async () => {
    if (!lijstEdit) return;
    await fetch('/api/actielijsten', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lijstEdit)
    });
    setLijstEdit(null);
    mutateLijsten();
  };

  const nieuweActieToevoegen = async () => {
    if (!nieuweActieTekst.trim() || !geselecteerdeLijst) return;
    await fetch('/api/acties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lijst_id: geselecteerdeLijst.id, tekst: nieuweActieTekst.trim() })
    });
    setNieuweActieTekst("");
    mutate();
  };

  useEffect(() => {
    if (lijsten && lijsten.length > 0 && !geselecteerdeLijst) {
      setGeselecteerdeLijst(lijsten[0]);
    }
  }, [lijsten]);

  if (lijstLoading) return <div className="p-6">Bezig met laden...</div>;
  if (lijstError) return <div className="p-6 text-red-600">Fout bij laden actielijsten.</div>;
  if (!lijsten || lijsten.length === 0) return <div className="p-6">Geen actielijsten gevonden.</div>;

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="col-span-1 space-y-2">
        <h2 className="text-lg font-semibold">Actielijst</h2>
        {lijsten.slice().sort((a, b) => a.naam.localeCompare(b.naam)).map((lijst) => (
          <div key={lijst.id} className="flex items-center gap-2">
            <button
              className={`flex-1 flex items-center gap-2 px-4 py-2 border rounded ${lijst.id === geselecteerdeLijst?.id ? "bg-gray-100 font-semibold" : "hover:bg-gray-50"}`}
              onClick={() => setGeselecteerdeLijst(lijst)}
            >
              <span>{lijst.icoon}</span> {lijst.naam}
            </button>
            <button onClick={() => setLijstEdit({ ...lijst })} className="text-sm text-blue-600">✏️</button>
            <button onClick={() => lijstVerwijderen(lijst.id)} className="text-sm text-red-500">🗑️</button>
          </div>
        ))}

        <div className="pt-4 space-y-2">
          <input
            className="w-full border rounded px-2 py-1"
            value={nieuweLijstNaam}
            onChange={(e) => setNieuweLijstNaam(e.target.value)}
            placeholder="Nieuwe lijstnaam"
          />
          <button
            onClick={nieuweLijstToevoegen}
            className="w-full bg-blue-500 text-white py-1 rounded"
          >
            + Nieuwe lijst
          </button>
        </div>

        {lijstEdit && (
          <div className="pt-4 space-y-2 border-t mt-4">
            <h3 className="text-sm font-semibold">Bewerk lijst</h3>
            <input
              className="w-full border rounded px-2 py-1"
              value={lijstEdit.naam}
              onChange={(e) => setLijstEdit({ ...lijstEdit, naam: e.target.value })}
            />
            <input
              className="w-full border rounded px-2 py-1"
              value={lijstEdit.icoon}
              onChange={(e) => setLijstEdit({ ...lijstEdit, icoon: e.target.value })}
            />
            <button onClick={lijstBijwerken} className="w-full bg-green-600 text-white py-1 rounded">Opslaan</button>
          </div>
        )}
      </div>

      <div className="col-span-2">
        <h2 className="text-lg font-semibold mb-4">{geselecteerdeLijst?.naam}</h2>

        <div className="space-y-2">
          {acties.map((actie) => (
            <div key={actie.id} className="flex items-center justify-between border p-3 rounded bg-white shadow-sm">
              <label className="flex items-center gap-3">
                <input
  type="checkbox"
  checked={false}
  onChange={() => toggleActie(actie.id, false)}
/>
                <button onClick={() => setActieEdit({ id: actie.id, tekst: actie.tekst })} className="text-left w-full">📝 {actie.tekst}</button>
              </label>
              <div className="text-sm text-gray-500">
                {actie.deadline && <span className="mr-2">{actie.deadline}</span>}
                {actie.verantwoordelijke && <span>{actie.verantwoordelijke}</span>}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2 pt-2">
          <input
            className="flex-1 border rounded px-2 py-1"
            placeholder="Nieuwe actie"
            value={nieuweActieTekst}
            onChange={(e) => setNieuweActieTekst(e.target.value)}
          />
          <button onClick={nieuweActieToevoegen} className="bg-blue-500 px-3 py-1 rounded text-xl font-bold">
            <span className="text-yellow-300 text-2xl font-bold">+</span>
          </button>
        </div>

        {actieEdit && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white p-8 rounded shadow-lg w-full max-w-2xl">
              <h3 className="text-lg font-semibold mb-2">Bewerk actie</h3>
              <input
                className="w-full border px-4 py-3 text-lg rounded mb-6"
                value={actieEdit.tekst}
                onChange={(e) => setActieEdit({ ...actieEdit, tekst: e.target.value })}
              />
              <div className="flex justify-between items-center gap-2">
                <button
                  onClick={async () => {
                    if (confirm('Weet je zeker dat je deze actie wilt verwijderen?')) {
                      await fetch('/api/acties', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: actieEdit.id })
                      });
                      setActieEdit(null);
                      mutate();
                    }
                  }}
                  className="text-red-600 mr-auto"
                >🗑️ Verwijderen</button>
                <button
                  onClick={() => setActieEdit(null)}
                  className="text-gray-600"
                >Annuleer</button>
                <button
                  onClick={async () => {
                    await updateActieTekst(actieEdit.id, actieEdit.tekst);
                    setActieEdit(null);
                  }}
                  className="bg-blue-600 text-white px-4 py-1 rounded"
                >
                  Opslaan
                </button>
              </div>
            </div>
          </div>
        )}

        {actiesRaw.some((a) => a.voltooid) && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Afgehandeld</h3>
            <div className="space-y-2">
              {actiesRaw.filter((a) => a.voltooid).map((actie) => (
                <div key={actie.id} className="flex items-center justify-between border p-3 rounded bg-gray-50 text-gray-500">
                  <label className="flex items-center gap-3">
                    <input
  type="checkbox"
  checked={true}
  onChange={() => toggleActie(actie.id, true)}
/>
                    <span className="line-through">{actie.tekst}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
