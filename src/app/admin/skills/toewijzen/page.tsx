// aangepaste versie van /admin/skills/toewijzen/page.tsx met categoriegroepering via categorie_naam
"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface Medewerker {
  id: number;
  naam: string;
}

interface Skill {
  id: string;
  naam: string;
  categorie_id: string;
  categorie_naam: string;
}

interface ToegewezenSkill {
  skill_id: string;
  deadline_dagen: number;
}

export default function SkillToewijzen() {
  const { data: medewerkersAPI } = useSWR<Medewerker[]>("/api/medewerkers", fetcher);
  const { data: skills } = useSWR<Skill[]>("/api/skills?type=skills", fetcher);
  const [geselecteerd, setGeselecteerd] = useState<number | null>(null);
  const [toewijzingen, setToewijzingen] = useState<Record<string, { actief: boolean; deadline: number }>>({});
  const [mailen, setMailen] = useState(true);

  useEffect(() => {
    if (geselecteerd !== null) {
      fetch(`/api/skills/toegewezen?medewerker_id=${geselecteerd}`)
        .then(res => res.json())
        .then((data: ToegewezenSkill[]) => {
          const ingevuld = Object.fromEntries(
            data.map((s) => [String(s.skill_id), { actief: true, deadline: Number(s.deadline_dagen) || 10 }])
          );
          setToewijzingen(ingevuld);
        });
    }
  }, [geselecteerd]);

  const toggle = (skill_id: string) => {
    setToewijzingen((prev) => ({
      ...prev,
      [skill_id]: prev[skill_id]
        ? { ...prev[skill_id], actief: !prev[skill_id].actief }
        : { actief: true, deadline: 10 },
    }));
  };


 const opslaan = async () => {
    if (!geselecteerd) return;
    const body = {
      sendEmail: mailen,
      items: Object.entries(toewijzingen)
        .filter(([, val]) => val.actief)
        .map(([skill_id, val]) => ({ medewerker_id: geselecteerd, skill_id, deadline_dagen: val.deadline || 10 }))
    };
    await fetch("/api/skills/toewijzen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    alert("Opgeslagen!");
  };

  if (!medewerkersAPI || !skills) return <div>Laden...</div>;

   const skillsPerCategorie = skills.reduce((acc: Record<string, Skill[]>, skill) => {
   const categorie = skill.categorie_naam ?? "Onbekend";
    if (!acc[categorie]) acc[categorie] = [];
    acc[categorie].push(skill);
    return acc;
  }, {});

   return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">🧠 Skillbeheer</h1>

      <div className="flex gap-4 items-center">
        <span>Kies medewerker:</span>
        <select
          className="border rounded px-2 py-1"
          value={geselecteerd !== null ? String(geselecteerd) : ""}
          onChange={(e) => {
            const val: string | undefined = e.target?.value;
            setGeselecteerd(val ? Number(val) : null);
          }}
        >
          <option value="">-- Selecteer --</option>
          {medewerkersAPI.map((m) => (
            <option key={m.id} value={m.id}>{m.naam}</option>
          ))}
        </select>
      </div>

      {geselecteerd !== null && (
        <div className="space-y-4">
          {Object.entries(skillsPerCategorie)
            .map(([categorie, lijst]) => (
            <Card key={categorie} className="p-4">
              <h2 className="font-semibold mb-2">{categorie}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                {lijst.map((s) => (
                  <label key={s.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={toewijzingen[s.id]?.actief || false}
                      onChange={() => toggle(s.id)}
                    />
                    <span>{s.naam}</span>
                    {toewijzingen[s.id]?.actief && (
                      <input
                        type="number"
                        className="w-20 border px-2 py-1 rounded"
                        value={(toewijzingen[s.id]?.deadline ?? 10).toString()}
                        onChange={(e) => {
                          const value = parseInt(e.target.value);
                          setToewijzingen((prev) => ({
                            ...prev,
                            [s.id]: {
                              ...prev[s.id],
                              deadline: isNaN(value) ? 10 : value,
                            },
                          }));
                        }}
                      />
                    )}
                  </label>
                ))}
              </div>
            </Card>
          ))}

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={mailen}
              onChange={(e) => setMailen(e.target.checked)}
            />
            <span>Stuur e-mail bij toewijzing</span>
          </label>
          <Button onClick={opslaan}>Opslaan</Button>
        </div>
      )}
    </div>
  );
}

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Fout bij ophalen");
  return res.json();
}
