"use client";

import Link from "next/link";
import useSWR from "swr";

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

export default function KeukenInstructiesPage() {
  const { data: instructies, error } = useSWR<Instructie[]>(
    "/api/instructies",
    fetcher
  );

  if (error) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/keuken"
            className="mb-6 inline-flex items-center text-slate-600"
          >
            ← Terug
          </Link>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            Fout bij laden van instructies.
          </div>
        </div>
      </main>
    );
  }

  if (!instructies) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/keuken"
            className="mb-6 inline-flex items-center text-slate-600"
          >
            ← Terug
          </Link>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-500 shadow-sm">
            Instructies laden...
          </div>
        </div>
      </main>
    );
  }

  const toegestaneFuncties = ["keukenmedewerkers", "ijsvoorbereiders"];

  const keukenInstructies = [...instructies]
    .filter((i) => {
      if (!i.functies || i.functies.length === 0) return false;

      const functies = i.functies.map((f) => f.toLowerCase().trim());

      return (
        functies.length > 0 &&
        functies.every((f) => toegestaneFuncties.includes(f))
      );
    })
    .sort((a, b) => {
      const na = a.nummer || "";
      const nb = b.nummer || "";
      return na.localeCompare(nb, "nl");
    });

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/keuken"
          className="mb-6 inline-flex items-center text-slate-600"
        >
          ← Terug
        </Link>

        <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">
          Werkinstructies & Skills
        </h1>

        <p className="mt-2 text-slate-600">
          Open instructies voor de keuken.
        </p>

        {keukenInstructies.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-slate-500">
            Er zijn nog geen keukeninstructies gekoppeld aan de functie
            “keuken”.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4">
            {keukenInstructies.map((item) => (
              <Link
                key={item.id}
                href={`/keuken/instructies-skills/${item.slug}`}
                className="flex h-[96px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center shadow-sm transition active:scale-95"
              >
                <span className="block max-w-[170px] text-lg font-semibold leading-snug text-slate-900">
                  {item.nummer ? `${item.nummer}. ` : ""}
                  {item.titel}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}