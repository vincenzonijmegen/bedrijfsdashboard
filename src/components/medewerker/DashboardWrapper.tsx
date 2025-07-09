// components/medewerker/DashboardWrapper.tsx

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

interface StatusRecord {
  slug: string;
  gelezen_op?: string;
  score?: number;
  totaal?: number;
  juist?: number;
}

interface Skill {
  status: "geleerd" | "niet_geleerd";
  deadline?: string;
}

interface Props {
  email: string;
  functie: string;
  naam: string;
  readonly?: boolean;
}

export default function DashboardWrapper({ email, functie, naam, readonly = false }: Props) {
  const [instructies, setInstructies] = useState<any[]>([]);
  const [status, setStatus] = useState<{ gelezen: number; totaal: number; geslaagd: number } | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);

  useEffect(() => {
    fetch("/api/instructies")
      .then((res) => res.json())
      .then((all) => {
        setInstructies(all);
        const totaal = all.length;

        fetch(`/api/instructiestatus?email=${email}`)
          .then((res) => res.json())
          .then((data: StatusRecord[]) => {
            const gelezen = data.filter((r) => r.gelezen_op).length;
            const geslaagd = data.filter((r) => r.score !== undefined && r.juist !== undefined && r.score === 100).length;
            setStatus({ gelezen, totaal, geslaagd });
          });
      });

    fetch("/api/skills/mijn", { headers: { "x-user-email": email } })
      .then((res) => res.json())
      .then((data) => setSkills(data.skills || []));
  }, [email]);

  const nogTeLeren = skills.filter((s) => s.status === "niet_geleerd").length;
  const deadlinesBinnen3Dagen = skills.filter((s) => {
    if (!s.deadline) return false;
    const diff = (new Date(s.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 3;
  }).length;

  if (!status) return <div className="p-6">Laden...</div>;

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Welkom, {naam}</h1>
        {!readonly && (
          <button
            onClick={async () => {
              await fetch("/api/logout", { method: "POST" });
              window.location.href = "/sign-in";
            }}
            className="text-sm text-red-600 underline"
          >
            Uitloggen
          </button>
        )}
      </div>

      <section className="space-y-4">
        <div className="p-4 border rounded bg-white shadow">
          <h2 className="font-semibold mb-2">👤 Persoonlijke gegevens</h2>
          <p><strong>Naam:</strong> {naam}</p>
          <p><strong>Email:</strong> {email}</p>
          <p><strong>Functie:</strong> {functie}</p>
        </div>

        <div className="p-4 border rounded bg-white shadow">
          <h2 className="font-semibold mb-2">📚 Werkinstructies</h2>
          <p><strong>Gelezen:</strong> {status.gelezen} / {status.totaal}</p>
          <p><strong>Geslaagd:</strong> {status.geslaagd}</p>
          {!readonly && (
            <Link href="/instructies" className="inline-block mt-2 text-blue-600 underline">
              ➤ Bekijk instructies
            </Link>
          )}
        </div>

        <div className="p-4 border rounded bg-white shadow">
          <h2 className="font-semibold mb-2">🧠 Skills</h2>
          <p><strong>Geleerd:</strong> {skills.length - nogTeLeren} / {skills.length}</p>
          <p><strong>Nog te doen:</strong> {nogTeLeren}</p>
          <p><strong>Met deadline &lt; 3 dagen:</strong> {deadlinesBinnen3Dagen}</p>
          {!readonly && (
            <Link href="/skills" className="inline-block mt-2 text-blue-600 underline">
              ➤ Bekijk skills
            </Link>
          )}
        </div>
      </section>
    </main>
  );
}
