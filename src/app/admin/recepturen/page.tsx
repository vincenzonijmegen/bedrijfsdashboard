import Link from "next/link";
import { query } from "@/lib/db";

type ReceptRow = {
  id: number;
  categorie: string;
  naam: string;
  hoeveelheid_mix: string | null;
  actief: boolean;
};

const categorieVolgorde = ["melksmaken", "vruchtensmaken", "suikervrij", "sauzen"];

const categorieTitels: Record<string, string> = {
  melksmaken: "Melksmaken",
  vruchtensmaken: "Vruchtensmaken",
  suikervrij: "Suikervrij",
  sauzen: "Sauzen",
};

export default async function AdminRecepturenPage() {
  const result = await query<ReceptRow>(
    `
    SELECT id, categorie, naam, hoeveelheid_mix, actief
    FROM keuken_recepten
    ORDER BY
      CASE categorie
        WHEN 'melksmaken' THEN 1
        WHEN 'vruchtensmaken' THEN 2
        WHEN 'suikervrij' THEN 3
        WHEN 'sauzen' THEN 4
        ELSE 99
      END,
      naam ASC
    `
  );

  const recepten = result.rows;

  const gegroepeerd = categorieVolgorde.map((categorie) => ({
    categorie,
    titel: categorieTitels[categorie] || categorie,
    items: recepten.filter((r) => r.categorie === categorie),
  }));

  return (
    <main className="max-w-6xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Admin
          </p>
          <h1 className="text-3xl font-bold text-slate-900">
            Recepturen keuken
          </h1>
          <p className="mt-2 text-slate-600">
            Overzicht van alle keukenrecepturen per categorie.
          </p>
        </div>

        <Link
          href="/admin"
          className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          ← Terug naar dashboard
        </Link>
      </div>

      <div className="mb-6">
        <Link
          href="/admin/recepturen/nieuw"
          className="inline-flex items-center rounded-lg bg-pink-600 px-4 py-2 text-sm font-medium text-white shadow hover:bg-pink-700"
        >
          + Nieuw recept
        </Link>
      </div>

      <div className="space-y-8">
        {gegroepeerd.map((groep) => (
          <section key={groep.categorie}>
            <h2 className="mb-3 text-xl font-semibold text-slate-800">
              {groep.titel}
            </h2>

            {groep.items.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-slate-500">
                Nog geen recepturen in deze categorie.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {groep.items.map((recept) => (
                  <div
                    key={recept.id}
                    className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900">
                          {recept.naam}
                        </h3>
                      </div>

                      <span
                        className={`rounded-full px-2 py-1 text-xs font-medium ${
                          recept.actief
                            ? "bg-green-100 text-green-800"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {recept.actief ? "Actief" : "Inactief"}
                      </span>
                    </div>

                    <div className="mt-4">
                      <Link
                        href={`/admin/recepturen/${recept.id}/bewerken`}
                        className="text-sm font-medium text-pink-700 hover:underline"
                      >
                        Bewerken →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}