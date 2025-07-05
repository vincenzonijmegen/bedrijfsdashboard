"use client";

import { useEffect, useState } from "react";

interface Skill {
  skill_id: string;
  skill_naam: string;
  categorie: string;
  status: "geleerd" | "niet_geleerd";
  omschrijving?: string;
  deadline?: string; // ISO datumstring
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

  const markeerAlsGeleerd = async (skill_id: string) => {
    await fetch("/api/skills/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ skill_id, status: "geleerd" }),
    });

    setSkills((prev) =>
      prev.map((s) =>
        s.skill_id === skill_id ? { ...s, status: "geleerd" } : s
      )
    );
  };

  // ✅ Dynamische kleur op basis van status en deadline
  const getKaartKleur = (skill: Skill) => {
    if (skill.status === "geleerd") return "bg-gray-200";

    if (skill.deadline) {
      const deadline = new Date(skill.deadline);
      const vandaag = new Date();
      const verschil = Math.ceil(
        (deadline.getTime() - vandaag.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (verschil < 0) return "bg-red-200";      // deadline verlopen
      if (verschil <= 3) return "bg-yellow-200";  // deadline nadert
    }

    return "bg-green-200"; // standaard: nieuw
  };

  return (
    <main className="max-w-5xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="Logo" className="h-10 w-auto" />
          <h1 className="text-3xl font-bold text-slate-800">
            Skilllijst – {gebruiker?.naam || "..."}
          </h1>
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
          skills.map((skill) => {
            const statusKleur =
              skill.status === "geleerd"
                ? "text-green-700 font-semibold"
                : "text-gray-500 italic";
            const statusLabel =
              skill.status === "geleerd" ? "✅ Geleerd" : "🕐 Nog niet geleerd";

            return (
              <div
                key={skill.skill_id}
                className={`rounded-lg shadow px-4 py-3 border ${getKaartKleur(skill)} group relative`}
                title={skill.omschrijving || ""}
              >
                <div className="font-semibold text-slate-800 mb-1">
                  {skill.skill_naam}
                </div>
                <div className="text-sm text-slate-700 mb-1 italic">
                  Categorie: {skill.categorie || "–"}
                </div>

                {skill.deadline && (
                  <div className="text-sm text-orange-700 mb-1">
                    🗓 Deadline:{" "}
                    {new Date(skill.deadline).toLocaleDateString("nl-NL", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                    })}
                  </div>
                )}

                <div className={`text-sm ${statusKleur}`}>{statusLabel}</div>

                {skill.status === "niet_geleerd" && (
                  <button
                    onClick={() => markeerAlsGeleerd(skill.skill_id)}
                    className="mt-2 text-sm text-blue-600 underline"
                  >
                    Markeer als geleerd
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
