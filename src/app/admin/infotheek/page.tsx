"use client";

import Link from "next/link";
import useSWR from "swr";
import { useMemo, useState } from "react";
import { BookOpen, Search, PlusCircle } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type Artikel = {
  id: number;
  slug: string;
  titel: string;
  categorie: string;
  samenvatting: string | null;
  zoekwoorden: string[] | null;
  laatst_bijgewerkt_op: string;
};

export default function InfotheekPage() {
  const [zoekterm, setZoekterm] = useState("");

  const { data, error } = useSWR(
    `/api/infotheek?q=${encodeURIComponent(zoekterm)}`,
    fetcher
  );

  const artikelen: Artikel[] = data?.artikelen || [];

  const groepen = useMemo(() => {
    return artikelen.reduce<Record<string, Artikel[]>>((acc, artikel) => {
      acc[artikel.categorie] ||= [];
      acc[artikel.categorie].push(artikel);
      return acc;
    }, {});
  }, [artikelen]);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-blue-700">
                <BookOpen className="h-4 w-4" />
                Management handboek
              </div>
              <h1 className="text-3xl font-bold text-slate-900">Infotheek</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-600">
                Centrale uitleg voor beheer, workflows, automatiseringen en vaste werkwijzen binnen de Vincenzo-app.
              </p>
            </div>

            <Link
              href="/admin/infotheek/nieuw"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <PlusCircle className="h-4 w-4" />
              Nieuw artikel
            </Link>
          </div>

          <div className="mt-6 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
            <Search className="h-5 w-5 text-slate-400" />
            <input
              value={zoekterm}
              onChange={(e) => setZoekterm(e.target.value)}
              placeholder="Zoek op onderwerp, knop, workflow, status of automatisering..."
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Fout bij laden van de infotheek.
          </div>
        )}

        {!data && !error && (
          <div className="rounded-xl bg-white p-6 text-sm text-slate-500 shadow-sm">
            Laden...
          </div>
        )}

        {data && artikelen.length === 0 && (
          <div className="rounded-xl bg-white p-6 text-sm text-slate-500 shadow-sm">
            Geen artikelen gevonden.
          </div>
        )}

        <div className="space-y-6">
          {Object.entries(groepen).map(([categorie, items]) => (
            <section key={categorie} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-slate-900">{categorie}</h2>

              <div className="grid gap-3 md:grid-cols-2">
                {items.map((artikel) => (
                  <Link
                    key={artikel.id}
                    href={`/admin/infotheek/${artikel.slug}`}
                    className="rounded-xl border border-slate-200 bg-slate-50 p-4 transition hover:border-blue-200 hover:bg-blue-50"
                  >
                    <h3 className="font-semibold text-slate-900">{artikel.titel}</h3>
                    {artikel.samenvatting && (
                      <p className="mt-1 text-sm text-slate-600">{artikel.samenvatting}</p>
                    )}
                    <p className="mt-3 text-xs text-slate-400">
                      Laatst bijgewerkt:{" "}
                      {new Date(artikel.laatst_bijgewerkt_op).toLocaleDateString("nl-NL")}
                    </p>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}