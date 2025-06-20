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

interface RawInstructie {
  id: string;
  titel: string;
  nummer?: string;
  functies?: string | string[];
  slug: string;
}

interface Status {
  slug: string;
  score?: number;
  totaal?: number;
  juist?: number;
  gelezen_op?: string;
}

const fetcher = async (url: string): Promise<Instructie[]> => {
  const res = await fetch(url);
  const data: RawInstructie[] = await res.json();
  return data.map((i) => ({
    ...i,
    functies: Array.isArray(i.functies)
      ? i.functies
      : typeof i.functies === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(i.functies);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })()
      : [],
  }));
};

export default function InstructieOverzicht() {
  const gebruiker = typeof window !== "undefined"
    ? JSON.parse(localStorage.getItem("gebruiker") || "{}")
    : {};
  const isAdmin = gebruiker?.functie?.toLowerCase() === "beheerder";
  const email = gebruiker?.email || "";

  const { data: instructies, error } = useSWR<Instructie[]>("/api/instructies", fetcher);

  const { data: status } = useSWR<Status[]>(
    email ? `/api/instructiestatus?email=${email}` : null,
    (url: string) => fetch(url).then(res => res.json())
  );

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

    if (s.score != null && s.totaal != null && s.juist != null) {
      const kleur = s.score < 100 ? "text-red-600" : "text-green-600";
      const datum = s.gelezen_op
        ? new Date(s.gelezen_op).toLocaleDateString("nl-NL", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })
        : null;
      return (
        <span className={kleur}>
          🧠 {s.juist}/{s.totaal}
          {datum && <span className="ml-2 text-blue-600">👁 {datum}</span>}
        </span>
      );
    }

    if (s.gelezen_op) {
      const datum = new Date(s.gelezen_op).toLocaleDateString("nl-NL", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      return <span className="text-blue-600">👁 {datum}</span>;
    }

    return <span className="text-blue-600">👁 Gelezen</span>;
  };

<button
  onClick={() => {
    localStorage.removeItem("gebruiker");
    window.location.href = "/sign-in";
  }}
  className="text-sm text-red-600 hover:underline"
>
  Uitloggen
</button>


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
