"use client";

import { useEffect, useState } from "react";

type Gebruiker = {
  naam: string;
  email: string;
};

export default function MijnSkillsPagina() {
  const [gebruiker, setGebruiker] = useState<Gebruiker | null>(null);
  const [skills, setSkills] = useState<any[]>([]);

  // Stap 1: haal ingelogde gebruiker op
  useEffect(() => {
    fetch("/api/user")
      .then((res) => res.json())
      .then((data) => setGebruiker(data));
  }, []);

  // Stap 2: haal skills op voor die gebruiker
  useEffect(() => {
    if (!gebruiker?.email) return;

    fetch("/api/skills/mijn", {
      headers: {
        "x-user-email": gebruiker.email,
      },
    })
      .then((res) => res.json())
      .then((data) => setSkills(data.skills || []));
  }, [gebruiker]);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-1">Mijn Skills</h1>
      <p className="text-sm text-gray-600 mb-4">
        Ingelogd als: <strong>{gebruiker?.naam || "?"}</strong>{" "}
        (<code>{gebruiker?.email || "?"}</code>)
      </p>

      <table className="table-auto w-full border">
        <thead>
          <tr>
            <th className="border p-2">#</th>
            <th className="border p-2">Categorie</th>
            <th className="border p-2">Skill</th>
            <th className="border p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {Array.isArray(skills) && skills.length > 0 ? (
            skills.map((s, i) => (
              <tr key={s.skill_id || i}>
                <td className="border p-2">{i + 1}</td>
                <td className="border p-2">{s.categorie || "-"}</td>
                <td className="border p-2">{s.skill_naam || "-"}</td>
                <td className="border p-2">{s.status || "-"}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td className="border p-2 text-center" colSpan={4}>
                Geen skills gevonden.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
