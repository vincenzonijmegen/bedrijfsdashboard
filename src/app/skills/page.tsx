"use client";

import { useEffect, useState } from "react";

interface Skill {
  skill_id: string;
  skill_naam: string;
  categorie: string;
  status: "geleerd" | "niet_geleerd";
}

interface Gebruiker {
  naam: string;
  email: string;
}

export default function MijnSkillsPagina() {
  const [gebruiker, setGebruiker] = useState<Gebruiker | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);

  useEffect(() => {
    fetch("/api/user")
      .then((res) => res.json())
      .then(setGebruiker);
  }, []);

  useEffect(() => {
    if (!gebruiker?.email) return;

    fetch("/api/skills/mijn", {
      headers: { "x-user-email": gebruiker.email },
    })
      .then((res) => res.json())
      .then((data) => setSkills(data.skills || []));
  }, [gebruiker]);

  const kleuren = ["bg-pink-200", "bg-blue-200", "bg-green-200", "bg-yellow-200", "bg-purple-200"];

  return (
    <main className="max-w-5xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="Logo" className="h-10 w-auto" />
          <h1 className="text-3xl font-bold text-slate-800">Mijn Skills</h1>
        </div>
        <button
          onClick={async () => {
            localStorage.removeItem("gebruiker");
            await fetch("/api/logout", { method: "POST" });
            window.location.href = "/sign-in";
          }}
          className="text-sm text-red-600 hover:underline"
        >
          Uitloggen
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {skills.length === 0 ? (
          <p className="text-gray-600 col-span-2">Geen skills gevonden.</p>
        ) : (
          skills.map((skill, index) => {
            const kleur = kleuren[index % kleuren.length];
            const statusKleur =
              skill.status === "geleerd"
                ? "text-green-700 font-semibold"
                : "text-gray-500 italic";

            const statusLabel =
              skill.status === "geleerd" ? "✅ Geleerd" : "🕐 Nog niet geleerd";

            return (
              <div
                key={skill.skill_id}
                className={`rounded-lg shadow px-4 py-3 border ${kleur}`}
              >
                <div className="font-semibold text-slate-800 mb-1">
                  {skill.skill_naam}
                </div>
                <div className="text-sm text-slate-700 mb-1 italic">
                  Categorie: {skill.categorie || "–"}
                </div>
                <div className={`text-sm ${statusKleur}`}>{statusLabel}</div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
