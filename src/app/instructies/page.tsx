"use client";

import useSWR from "swr";
import Link from "next/link";

interface Instructie {
  id: string;
  titel: string;
  nummer?: string;
  functies?: string[];
  slug: string;
}

interface Status {
  slug: string;
  gelezen?: boolean;
  score?: number;
  totaal?: number;
}

const fetcher = async (url: string): Promise<any> => {
  const res = await fetch(url);
  return res.json();
};

export default function InstructieOverzicht() {
  const gebruiker = typeof window !== "undefined"
    ? JSON.parse(localStorage.getItem("gebruiker") || "{}")
    : {};
  const isAdmin = gebruiker?.functie?.toLowerCase() === "beheerder";
  const email = gebruiker?.email || "";

  const { data: instructies, error } = useSWR<Instructie[]>("/api/instructies", fetcher);
  const { data: status } = useSWR<Status[]>(email ? `/api/instructiestatus?email=${email}` : null, fetcher);

  if (error) return <div>Fout bij laden</div>;
  if (!instructies) return <div>Laden...</div>;

  const gesorteerd = [...instructies].sort((a, b) => {
    const na = a.nummer || "";
    const nb = b.nummer || "";
    return na.localeCompare(nb);
  });

  const getStatus = (slug: string) => {
    const s = status?.find((x) => x.slug === slug);
    if (!s) return <span className="text-gray-400">⏳ Nog niet gelezen</span>;
    if (s.gelezen && s.score !== undefined) {
      const kleur = s.score < s.totaal ? "text-red-600" : "text-green-600";
      return <span className={kleur}>🧠 {s.score}/{s.totaal}</span>;
    }
    if (s.gelezen) return <span className="text-blue-600">👁 Gelezen</span>;
    return <span className="text-gray-400">⏳ Nog niet gelezen</span>;
  };

  return (
    <main className="max-w-4xl mx-auto p-4">
      {isAdmin && (
        <Link
          href="/admin"
          className="inline-block mb-4 bg-gray-200 text-sm text-gray-800 px-3 py-1 rounded hover:bg-gray-300"
        >
          ← Terug naar beheer
        </Link>
      )}

      <h1 className="text-2xl font-bold mb-4">📘 Werkinstructies</h1>

      <ul className="space-y-4">
        {gesorteerd.map((i) => (
          <li key={i.id} className="border p-4 rounded shadow bg-white">
            <div className="flex justify-between items-center">
              <Link href={`/instructies/${i.slug}`} className="text-blue-600 font-semibold">
                {i.nummer ? `${i.nummer}. ` : ""}{i.titel}
              </Link>
              <div className="text-sm">{getStatus(i.slug)}</div>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
