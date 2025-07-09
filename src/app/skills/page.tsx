// Skills pagina met auth check
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

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
  const router = useRouter();

  useEffect(() => {
    fetch("/api/user")
      .then((res) => {
        if (!res.ok) throw new Error("Niet ingelogd");
        return res.json();
      })
      .then((data) => setGebruiker(data))
      .catch(() => {
        localStorage.removeItem("gebruiker");
        router.push("/sign-in");
      });
  }, [router]);

  useEffect(() => {
    if (!gebruiker?.email) return;
    fetch("/api/skills/mijn", {
      headers: { "x-user-email": gebruiker.email },
    })
      .then((res) => res.json())
      .then((data) => setSkills(data.skills || []));
  }, [gebruiker]);

  const markeerAlsGeleerd = async (skill_id: string) => {
    if (!gebruiker?.email) return;

    const res = await fetch("/api/skills/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        skill_id,
        status: "geleerd",
        email: gebruiker.email,
      }),
    });

    if (res.ok) {
      alert("✓ Opgeslagen als geleerd");
      setSkills((prev) =>
        prev.map((s) =>
          s.skill_id === skill_id ? { ...s, status: "geleerd" } : s
        )
      );
    }
(prev) =>
      prev.map((s) =>
        s.skill_id === skill_id ? { ...s, status: "geleerd" } : s
      )
    );
  };

  const getKaartKleur = (skill: Skill) => {
    if (skill.status === "geleerd") return "bg-gray-200";
    if (skill.deadline) {
      const deadline = new Date(skill.deadline);
      const verschil = Math.ceil((deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (verschil < 0) return "bg-red-200";
      if (verschil <= 3) return "bg-yellow-200";
    }
    return "bg-green-200";
  };

  if (!gebruiker) return <main className="p-6">Laden gebruiker...</main>;

  return (
    <main className="max-w-5xl mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <img src="/logo.png" alt="Logo" className="h-10 w-auto" />
          <h1 className="text-3xl font-bold text-slate-800">
            Skilllijst – {gebruiker?.naam || "..."}
          </h1>
        </div>
        <div className="flex gap-4">
          <Link href="/medewerker" className="text-sm text-blue-600 underline">
            ⬅ Terug naar dashboard
          </Link>
          <button
            onClick={async () => {
              localStorage.removeItem("gebruiker");
              await fetch("/api/logout", { method: "POST" });
              router.push("/sign-in");
            }}
            className="text-sm text-red-600 underline"
          >
            Uitloggen
          </button>
        </div>
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
              skill.status === "geleerd"
                ? "✅ Geleerd"
                : "🕐 Nog niet geleerd";

            return (
              <div
                key={skill.skill_id}
                className={`rounded-lg shadow px-4 py-3 border ${getKaartKleur(skill)} relative`}
                title={skill.omschrijving || ""}
              >
                <div className="font-semibold text-slate-800 mb-1">
                  {skill.skill_naam}
                </div>
                <div className="text-sm text-slate-700 mb-1 italic">
                  Categorie: {skill.categorie || "–"}
                </div>

                {skill.omschrijving && (
                  <details className="sm:hidden text-sm text-slate-600 mb-2">
                    <summary className="cursor-pointer text-blue-700 underline">
                      Toon uitleg
                    </summary>
                    <div className="mt-1 whitespace-pre-line">
                      {skill.omschrijving}
                    </div>
                  </details>
                )}

                {skill.deadline && (
                  <div className="text-sm text-orange-700 mb-1">
                    🗓 Deadline: {new Date(skill.deadline).toLocaleDateString("nl-NL")}
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
