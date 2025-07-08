"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Gebruiker {
  naam: string;
  email: string;
  functie: string;
}

interface StatusRecord {
  slug: string;
  gelezen_op?: string;
  score?: number;
  totaal?: number;
  juist?: number;
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
  const [instructies, setInstructies] = useState<any[]>([]);
  const [instructieStatus, setInstructieStatus] = useState<Status | null>(null);
  const [skills, setSkills] = useState<Skill[]>([]);

  // Haal ingelogde gebruiker op
  useEffect(() => {
    fetch("/api/user")
      .then((res) => {
        if (!res.ok) throw new Error("Niet ingelogd");
        return res.json();
      })
      .then(setGebruiker)
      .catch(() => router.push("/sign-in"));
  }, [router]);

  // Haal instructies, status en skills op zodra gebruiker bekend is
  useEffect(() => {
    if (!gebruiker?.email) return;

    // 1) alle instructies
    fetch("/api/instructies")
      .then((res) => res.json())
      .then((all) => {
        setInstructies(all);
        const totaal = all.length;

        // 2) statusrecords voor deze gebruiker
        fetch(`/api/instructiestatus?email=${gebruiker.email}`)
          .then((res) => res.json())
          .then((data: StatusRecord[]) => {
            const gelezen = data.filter((r) => r.gelezen_op).length;
            const geslaagd = data.filter((r) => r.score !== undefined && r.juist !== undefined && r.score === 100).length;
            setInstructieStatus({ gelezen, totaal, geslaagd });
          });
      });

    // 3) skills
    fetch("/api/skills/mijn", { headers: { "x-user-email": gebruiker.email } })
      .then((res) => res.json())
      .then((data) => setSkills(data.skills || []));
  }, [gebruiker]);

  const nogTeLeren = skills.filter((s) => s.status === "niet_geleerd").length;
  const deadlinesBinnen3Dagen = skills.filter((s) => {
    if (!s.deadline) return false;
    const diff = (new Date(s.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 3;
  }).length;

  if (!gebruiker || !instructieStatus) return <main className="p-6">Laden...</main>;

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Welkom, {gebruiker.naam}</h1>
        <button
          onClick={async () => {
            await fetch("/api/logout", { method: "POST" });
            router.push("/sign-in");
          }}
          className="text-sm text-red-600 underline"
        >
          Uitloggen
        </button>
      </div>

      <section className="space-y-4">
        <div className="p-4 border rounded bg-white shadow">
          <h2 className="font-semibold mb-2">👤 Persoonlijke gegevens</h2>
          <p><strong>Naam:</strong> {gebruiker.naam}</p>
          <p><strong>Email:</strong> {gebruiker.email}</p>
          <p><strong>Functie:</strong> {gebruiker.functie}</p>
        </div>

        <div className="p-4 border rounded bg-white shadow">
          <h2 className="font-semibold mb-2">📚 Werkinstructies</h2>
          <p><strong>Gelezen:</strong> {instructieStatus.gelezen} / {instructieStatus.totaal}</p>
          <p><strong>Geslaagd:</strong> {instructieStatus.geslaagd}</p>
          <Link href="/instructies" className="inline-block mt-2 text-blue-600 underline">
            ➤ Bekijk instructies
          </Link>
        </div>

        <div className="p-4 border rounded bg-white shadow">
          <h2 className="font-semibold mb-2">🧠 Skills</n
