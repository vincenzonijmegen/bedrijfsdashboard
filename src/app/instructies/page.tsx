
"use client";

import useSWR from "swr";
import Link from "next/link";
import { handleLogout } from "@/utils/auth";

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

  const gesorteerd = [...instructies]
    .filter((i) => {
      if (!i.functies || i.functies.length === 0) return true;
      return isAdmin || !gebruiker?.functie || i.functies.map(f => f.toLowerCase()).includes(gebruiker.functie.toLowerCase());
    })
    .sort((a, b) => {
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

  return (
  <main className="max-w-5xl mx-auto p-4">
    <div className="flex justify-between items-center mb-6">
      <div className="flex items-center gap-4">
        <img src="/logo.png" alt="Logo" className="h-10 w-auto" />
        <h1 className="text-3xl font-bold text-slate-800">
        Werkinstructies – {gebruiker?.naam || "..."}
        </h1>

      </div>


<button
  onClick={handleLogout}
  className="text-sm text-red-600 underline"
>
  Uitloggen
</button>

    </div>

    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {gesorteerd.map((i, index) => {
        const kleuren = ["bg-pink-200", "bg-purple-200", "bg-green-200", "bg-yellow-200", "bg-blue-200"];
        const kleur = kleuren[index % kleuren.length];

        return (
          <Link
            key={i.id}
            href={`/instructies/${i.slug}`}
            className={`rounded-lg shadow px-4 py-3 hover:shadow-md transition border ${kleur}`}
          >
            <div className="flex justify-between items-center">
              <div className="font-semibold text-slate-800">
                {i.nummer ? `${i.nummer}. ` : ""}
                {i.titel}
              </div>
              <div className="text-sm">{getStatus(i.slug)}</div>
            </div>
          </Link>
        );
      })}
    </div>
  </main>
);
}
