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
}

interface ActieLijst {
  id: number;
  naam: string;
  icoon: string;
}

export default function ActieLijstPagina() {
  const { data: lijsten } = useSWR<ActieLijst[]>('/api/actielijsten', fetcher);
  const [geselecteerdeLijst, setGeselecteerdeLijst] = useState<ActieLijst | null>(null);
  const { data: acties = [], mutate } = useSWR<Actie[]>(
    geselecteerdeLijst ? `/api/acties?lijst_id=${geselecteerdeLijst.id}` : null,
    fetcher
  );

  const toggleActie = async (id: number, voltooid: boolean) => {
    await fetch('/api/acties', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, voltooid: !voltooid })
    });
    mutate();
  };

  useEffect(() => {
    if (lijsten && lijsten.length > 0 && !geselecteerdeLijst) {
      setGeselecteerdeLijst(lijsten[0]);
    }
  }, [lijsten]);

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="col-span-1 space-y-2">
        <h2 className="text-lg font-semibold">Actielijst</h2>
        {lijsten?.map((lijst) => (
          <button
            key={lijst.id}
            className={`w-full flex items-center gap-2 px-4 py-2 border rounded ${lijst.id === geselecteerdeLijst?.id ? "bg-gray-100 font-semibold" : "hover:bg-gray-50"}`}
            onClick={() => setGeselecteerdeLijst(lijst)}
          >
            <span>{lijst.icoon}</span> {lijst.naam}
          </button>
        ))}
      </div>

      <div className="col-span-2">
        <h2 className="text-lg font-semibold mb-4">{geselecteerdeLijst?.naam}</h2>

        <div className="space-y-2">
          {acties.filter((a) => !a.voltooid).map((actie) => (
            <div key={actie.id} className="flex items-center justify-between border p-3 rounded bg-white shadow-sm">
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={actie.voltooid}
                  onChange={() => toggleActie(actie.id, actie.voltooid)}
                />
                <span>{actie.tekst}</span>
              </label>
              <div className="text-sm text-gray-500">
                {actie.deadline && <span className="mr-2">{actie.deadline}</span>}
                {actie.verantwoordelijke && <span>{actie.verantwoordelijke}</span>}
              </div>
            </div>
          ))}
        </div>

        {acties.some((a) => a.voltooid) && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Afgehandeld</h3>
            <div className="space-y-2">
              {acties.filter((a) => a.voltooid).map((actie) => (
                <div key={actie.id} className="flex items-center justify-between border p-3 rounded bg-gray-50 text-gray-500">
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked
                      onChange={() => toggleActie(actie.id, actie.voltooid)}
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
