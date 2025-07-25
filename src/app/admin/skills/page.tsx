// aangepaste versie van /admin/skills/page.tsx die gebruik maakt van categorie_id
"use client";

import { useEffect, useState } from "react";

interface Skill {
  id: string;
  naam: string;
  categorie_id: string;
  beschrijving: string;
  actief: boolean;
}

interface Categorie {
  id: string;
  naam: string;
}

function BeschrijvingPopup({ beschrijving, onSave }: { beschrijving: string; onSave: (inhoud: string) => void }) {
  const [open, setOpen] = useState(false);
  const [tekst, setTekst] = useState(beschrijving);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-sm text-blue-600 underline"
      >
        ✏️ Bewerken
      </button>

      {open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded p-6 w-full max-w-2xl space-y-4">
            <h2 className="text-lg font-semibold">Beschrijving bewerken</h2>
            <textarea className="w-full border rounded p-4 min-h-[300px] text-base resize-y"
              value={tekst}
              onChange={(e) => setTekst(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-1 rounded border text-gray-600 hover:bg-gray-100"
              >
                Annuleren
              </button>
              <button
                onClick={() => {
                  onSave(tekst);
                  setOpen(false);
                }}
                className="px-4 py-1 rounded bg-blue-600 text-white"
              >
                Opslaan
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function SkillBeheer() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [categorieen, setCategorieen] = useState<Categorie[]>([]);
  const [nieuw, setNieuw] = useState({ naam: "", categorie_id: "" });
  const [succes, setSucces] = useState(false);

  useEffect(() => {
    fetch("/api/skills")
      .then((res) => res.json())
      .then((data) => setSkills(data));

    fetch("/api/skills/categorieen")
      .then((res) => res.json())
      .then((data) => setCategorieen(data));
  }, [succes]);

  const update = (id: string, veld: keyof Skill, waarde: string | boolean) => {
    setSkills((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [veld]: waarde } : s))
    );
  };

  const opslaan = async (skill: Skill) => {
    const res = await fetch("/api/skills", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(skill),
    });
    if (res.ok) setSucces(true);
  };

  const toevoegen = async () => {
    if (!nieuw.naam || !nieuw.categorie_id) return;
    const res = await fetch("/api/skills", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nieuw),
    });
    if (res.ok) {
      setNieuw({ naam: "", categorie_id: "" });
      setSucces(true);
    }
  };

  const gegroepeerd: Record<string, Skill[]> = {};
  skills.forEach((s) => {
    const cat = categorieen.find((c) => c.id === s.categorie_id)?.naam || "Onbekend";
    if (!gegroepeerd[cat]) gegroepeerd[cat] = [];
    gegroepeerd[cat].push(s);
  });

  return (
    <div className="w-full px-12 py-6 space-y-6 overflow-x-hidden">
      <h1 className="text-2xl font-bold">🧩 Skillbeheer</h1>

      <div className="bg-slate-50 p-4 rounded border w-full">
        <h2 className="font-semibold mb-2">➕ Nieuwe skill toevoegen</h2>
        <div className="flex flex-wrap gap-4 mb-2">
          <input
            value={nieuw.naam}
            onChange={(e) => setNieuw({ ...nieuw, naam: e.target.value })}
            placeholder="Skillnaam"
            className="border px-2 py-1 rounded min-w-[200px] flex-1"
          />
          <select
            value={nieuw.categorie_id}
            onChange={(e) => setNieuw({ ...nieuw, categorie_id: e.target.value })}
            className="border px-2 py-1 rounded min-w-[200px] flex-1"
          >
            <option value="">Selecteer categorie</option>
            {categorieen.map((c) => (
              <option key={c.id} value={c.id}>{c.naam}</option>
            ))}
          </select>
          <button onClick={toevoegen} className="bg-green-600 text-white px-4 py-1 rounded">
            Toevoegen
          </button>
        </div>
      </div>

      {Object.entries(gegroepeerd).map(([cat, lijst]) => (
        <div key={cat} className="space-y-2">
          <h3 className="text-lg font-semibold mt-6">📁 {cat}</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm border">
              <thead>
                <tr className="bg-slate-100">
                  <th className="border p-2 text-left w-[20%]">Naam</th>
                  <th className="border p-2 text-left w-[50%]">Beschrijving</th>
                  <th className="border p-2 text-left w-[20%]">Categorie</th>
                  <th className="border p-2 text-center w-[10%]">Actie</th>
                </tr>
              </thead>
              <tbody>
                {lijst.map((s) => (
                  <tr key={s.id}>
                    <td className="border p-2">
                      <input
                        value={s.naam}
                        onChange={(e) => update(s.id, "naam", e.target.value)}
                        className="w-full border rounded px-2 py-1"
                      />
                    </td>
                    <td className="border p-2">
  <div className="text-sm text-gray-800 whitespace-pre-line mb-1">
    {s.beschrijving || <em className="text-gray-400">(geen beschrijving)</em>}
  </div>
  <BeschrijvingPopup
    beschrijving={s.beschrijving || ""}
    onSave={(inhoud) => update(s.id, "beschrijving", inhoud)}
  />
</td>
                    <td className="border p-2">
                      <select
                        value={s.categorie_id}
                        onChange={(e) => update(s.id, "categorie_id", e.target.value)}
                        className="w-full border rounded px-2 py-1"
                      >
                        {categorieen.map((c) => (
                          <option key={c.id} value={c.id}>{c.naam}</option>
                        ))}
                      </select>
                    </td>
                    <td className="border p-2 text-center space-y-1">
                      <button
                        onClick={() => opslaan(s)}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-sm w-full"
                      >
                        Opslaan
                      </button>
                      <button
                        onClick={async () => {
                          if (!confirm("Weet je zeker dat je deze skill wilt verwijderen?")) return;
                          const res = await fetch(`/api/skills?id=${s.id}`, { method: "DELETE" });
                          if (res.ok) setSucces(true);
                          else alert("Kan niet verwijderen: skill is nog gekoppeld.");
                        }}
                        className="bg-red-600 text-white px-3 py-1 rounded text-sm w-full"
                      >
                        ❌ Verwijderen
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
