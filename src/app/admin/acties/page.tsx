"use client";

import { useState } from "react";

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

const voorbeeldLijsten: ActieLijst[] = [
  { id: 1, naam: "Winterklaar maken", icoon: "❄️" },
  { id: 2, naam: "Lopende acties", icoon: "✅" },
  { id: 3, naam: "Opstarten seizoen", icoon: "📅" },
];

const voorbeeldActies: Actie[] = [
  { id: 1, tekst: "Vriezers schoonmaken", voltooid: false },
  { id: 2, tekst: "Slagroommachine ontkalken", voltooid: false, deadline: "15 okt." },
  { id: 3, tekst: "Buitenbank opbergen", voltooid: false, verantwoordelijke: "Herman" },
  { id: 4, tekst: "Kachel uitschakelen", voltooid: true },
];

export default function ActieLijstPagina() {
  const [geselecteerdeLijst, setGeselecteerdeLijst] = useState<ActieLijst>(voorbeeldLijsten[0]);
  const [acties, setActies] = useState<Actie[]>(voorbeeldActies);

  const toggleActie = (id: number) => {
    setActies((prev) =>
      prev.map((actie) =>
        actie.id === id ? { ...actie, voltooid: !actie.voltooid } : actie
      )
    );
  };

  return (
    <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="col-span-1 space-y-2">
        <h2 className="text-lg font-semibold">Actielijst</h2>
        {voorbeeldLijsten.map((lijst) => (
          <button
            key={lijst.id}
            className={`w-full flex items-center gap-2 px-4 py-2 border rounded ${lijst.id === geselecteerdeLijst.id ? "bg-gray-100 font-semibold" : "hover:bg-gray-50"}`}
            onClick={() => setGeselecteerdeLijst(lijst)}
          >
            <span>{lijst.icoon}</span> {lijst.naam}
          </button>
        ))}
        <button className="w-full px-4 py-2 text-left text-blue-600 hover:underline">
          + Nieuwe lijst
        </button>
      </div>

      <div className="col-span-2">
        <h2 className="text-lg font-semibold mb-4">{geselecteerdeLijst.naam}</h2>

        <div className="space-y-2">
          {acties.filter((a) => !a.voltooid).map((actie) => (
            <div
              key={actie.id}
              className="flex items-center justify-between border p-3 rounded bg-white shadow-sm"
            >
              <label className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={actie.voltooid}
                  onChange={() => toggleActie(actie.id)}
                />
                <span>{actie.tekst}</span>
              </label>
              <div className="text-sm text-gray-500">
                {actie.deadline && <span className="mr-2">{actie.deadline}</span>}
                {actie.verantwoordelijke && <span>{actie.verantwoordelijke}</span>}
              </div>
            </div>
          ))}

          <button className="text-blue-600 hover:underline">+ Nieuwe actie</button>
        </div>

        {acties.some((a) => a.voltooid) && (
          <div className="mt-8">
            <h3 className="text-sm font-semibold text-gray-600 mb-2">Afgehandeld</h3>
            <div className="space-y-2">
              {acties.filter((a) => a.voltooid).map((actie) => (
                <div
                  key={actie.id}
                  className="flex items-center justify-between border p-3 rounded bg-gray-50 text-gray-500"
                >
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked
                      onChange={() => toggleActie(actie.id)}
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
