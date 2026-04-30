"use client";

import useSWR from "swr";
import Link from "next/link";
import { handleLogout } from "@/utils/auth";
import { BookOpen, LogOut } from "lucide-react";

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
  const gebruiker =
    typeof window !== "undefined"
      ? JSON.parse(localStorage.getItem("gebruiker") || "{}")
      : {};

  const isAdmin =
    gebruiker?.functie?.toLowerCase() === "beheerder";

  const email = gebruiker?.email || "";

  const { data: instructies, error } = useSWR<Instructie[]>(
    "/api/instructies",
    fetcher
  );

  const { data: status } = useSWR<Status[]>(
    email ? `/api/instructiestatus?email=${email}` : null,
    (url: string) => fetch(url).then((res) => res.json())
  );

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="max-w-5xl mx-auto bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl">
          Fout bij laden instructies
        </div>
      </div>
    );
  }

  if (!instructies) {
    return (
      <div className="min-h-screen bg-slate-100 p-6">
        <div className="max-w-5xl mx-auto bg-white p-6 rounded-xl shadow-sm text-center">
          Laden...
        </div>
      </div>
    );
  }

  const gesorteerd = [...instructies]
    .filter((i) => {
      if (!i.functies || i.functies.length === 0) return true;
      return (
        isAdmin ||
        !gebruiker?.functie ||
        i.functies
          .map((f) => f.toLowerCase())
          .includes(gebruiker.functie.toLowerCase())
      );
    })
    .sort((a, b) => (a.nummer || "").localeCompare(b.nummer || ""));

  const getStatus = (slug: string) => {
    const s = status?.find((x) => x.slug === slug);

    if (!s) {
      return (
        <span className="text-xs text-slate-400">
          Niet gelezen
        </span>
      );
    }

    if (s.score != null && s.totaal != null && s.juist != null) {
      const kleur =
        s.score < 100
          ? "bg-red-50 text-red-700"
          : "bg-emerald-50 text-emerald-700";

      return (
        <span
          className={`text-xs px-2 py-0.5 rounded-full font-medium ${kleur}`}
        >
          {s.juist}/{s.totaal}
        </span>
      );
    }

    if (s.gelezen_op) {
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
          Gelezen
        </span>
      );
    }

    return null;
  };

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6">
      <div className="max-w-5xl mx-auto">

        {/* HEADER */}
        <div className="mb-6 bg-white border border-slate-200 rounded-2xl px-6 py-4 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BookOpen className="text-blue-600" />
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                Werkinstructies
              </h1>
              <p className="text-sm text-slate-500">
                {gebruiker?.naam || ""}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 text-sm text-red-600 hover:underline"
          >
            <LogOut size={16} />
            Uitloggen
          </button>
        </div>

        {/* GRID */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {gesorteerd.map((i) => (
            <Link
              key={i.id}
              href={`/instructies/${i.slug}`}
              className="bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm hover:shadow-md transition"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-semibold text-slate-900">
                  {i.nummer ? `${i.nummer}. ` : ""}
                  {i.titel}
                </div>

                {getStatus(i.slug)}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}