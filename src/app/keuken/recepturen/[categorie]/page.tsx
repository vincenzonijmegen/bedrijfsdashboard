export const revalidate = 300;

import Link from "next/link";
import { query } from "@/lib/db";

type Recept = {
  id: number;
  categorie: string;
  naam: string;
};

const categorieTitels: Record<string, string> = {
  melksmaken: "Melksmaken",
  vruchtensmaken: "Vruchtensmaken",
  suikervrij: "Suikervrij",
  sauzen: "Sauzen",
};

async function getRecepten(categorie: string): Promise<Recept[]> {
  const result = await query<Recept>(
    `
    SELECT id, categorie, naam
    FROM keuken_recepten
    WHERE actief = true
      AND categorie = $1
    ORDER BY naam ASC
    `,
    [categorie]
  );

  return result.rows;
}

export default async function ReceptCategoriePage({
  params,
}: {
  params: Promise<{ categorie: string }>;
}) {
  const { categorie } = await params;
  const recepten = await getRecepten(categorie);

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/keuken/recepturen"
          className="mb-6 inline-block text-slate-600"
        >
          ← Terug
        </Link>

        <h1 className="text-3xl font-bold text-slate-900">
          {categorieTitels[categorie] || categorie}
        </h1>

        {recepten.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-slate-500">
            Nog geen recepten in deze categorie.
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
            {recepten.map((recept) => (
              <Link
                key={recept.id}
                href={`/keuken/recepturen/${categorie}/${recept.id}`}
                className="flex h-[96px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center shadow-sm transition active:scale-95"
              >
                <span className="block max-w-[170px] text-lg font-semibold leading-snug text-slate-900">
                  {recept.naam}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}