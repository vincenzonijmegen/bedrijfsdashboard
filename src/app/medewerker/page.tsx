"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Gebruiker {
  naam: string;
  email: string;
  functie: string;
}

interface Status {
  gelezen: number;
  totaal: number;
  geslaagd: number;
}

interface Skill {
  status: "geleerd" | "niet_geleerd";
  deadline?: string;
}

export default function DashboardPagina() {
  const router = useRouter();
  const [gebruiker, setGebruiker] = useState<Gebruiker | null>(null);
  const [instructieStatus, setInstructieStatus] = useState<Status | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);

  useEffect(() => {
    fetch("/api/user")
      .then((res) => {
        if (!res.ok) throw new Error("Niet ingelogd");
        return res.json();
      })
      .then(setGebruiker)
      .catch(() => router.push("/sign-in"));
  }, [router]);

  useEffect(() => {
    if (!gebruiker?.email) return;

    fetch(`/api/instructiestatus?email=${gebruiker.email}`)
      .then(res => res.json())
      .then((data) => {
        const gelezen = data.filter((d: any) => d.gelezen_op).length;
        const totaal = data.length;
        const geslaagd = data.filter((d: any) => d.score >= 80).length;
        setInstructieStatus({ gelezen, totaal, geslaagd });
      });

    fetch("/api/skills/mijn", {
      headers: { "x-user-email": gebruiker.email },
    })
      .then(res => res.json())
      .then((data) => setSkills(data.skills || []));
  }, [gebruiker]);

  const nogTeLeren = skills.filter(s => s.status === "niet_geleerd").length;
  const deadlinesBinnen3Dagen = skills.filter(s => {
    if (!s.deadline) return false;
    const diff = (new Date(s.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 3;
  }).length;

  if (!gebruiker) return <main className="p-6">Laden gebruiker...</main>;

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Welkom, {gebruiker.naam}</h1>

      <section className="grid sm:grid-cols-2 gap-4">
        <div className="p-4 border rounded bg-white shadow">
          <h2 className="font-semibold mb-2">👤 Persoonlijke gegevens</h2>
          <p><strong>Naam:</strong> {gebruiker.naam}</p>
          <p><strong>Email:</strong> {gebruiker.email}</p>
          <p><strong>Functie:</strong> {gebruiker.functie}</p>
        </div>

        <div className="p-4 border rounded bg-white shadow">
          <h2 className="font-semibold mb-2">📚 Werkinstructies</h2>
          {instructieStatus ? (
            <>
              <p><strong>Gelezen:</strong> {instructieStatus.gelezen} / {instructieStatus.totaal}</p>
              <p><strong>Geslaagd:</strong> {instructieStatus.geslaagd}</p>
              <Link href="/instructies" className="inline-block mt-2 text-blue-600 underline">
                ➤ Bekijk instructies
              </Link>
            </>
          ) : <p>Laden...</p>}
        </div>

        <div className="p-4 border rounded bg-white shadow">
          <h2 className="font-semibold mb-2">🧠 Skills</h2>
          <p><strong>Geleerd:</strong> {skills.length - nogTeLeren} / {skills.length}</p>
          <p><strong>Nog te doen:</strong> {nogTeLeren}</p>
          <p><strong>Met deadline &lt; 3 dagen:</strong> {deadlinesBinnen3Dagen}</p>
          <Link href="/skills" className="inline-block mt-2 text-blue-600 underline">
            ➤ Bekijk skills
          </Link>
        </div>
      </section>
    </main>
  );
}
