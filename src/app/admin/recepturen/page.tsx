import Link from "next/link";
import { query } from "@/lib/db";

type ReceptRow = {
  id: number;
  categorie: string;
  naam: string;
  hoeveelheid_mix: string | null;
  actief: boolean;
  categorie_slug: string;
  categorie_naam: string;
  categorie_sortering: number;
};

type GegroepeerdeCategorie = {
  categorie: string;
  titel: string;
  sortering: number;
  items: ReceptRow[];
};

export default async function AdminRecepturenPage() {
  const result = await query<ReceptRow>(
    `
    SELECT
      r.id,
      r.categorie,
      r.naam,
      r.hoeveelheid_mix,
      r.actief,
      c.slug AS categorie_slug,
      c.naam AS categorie_naam,
      c.sortering AS categorie_sortering
    FROM keuken_recepten r
    JOIN keuken_categorieen c
      ON lower(trim(r.categorie)) = c.slug
    WHERE c.actief = true
    ORDER BY
      c.sortering ASC,
      r.naam ASC
    `
  );

  const recepten = result.rows;

  const gegroepeerdMap = new Map<string, GegroepeerdeCategorie>();

  for (const recept of recepten) {
    if (!gegroepeerdMap.has(recept.categorie_slug)) {
      gegroepeerdMap.set(recept.categorie_slug, {
        categorie: recept.categorie_slug,
        titel: recept.categorie_naam,
        sortering: recept.categorie_sortering,
        items: [],
      });
    }

    gegroepeerdMap.get(recept.categorie_slug)!.items.push(recept);
  }

  const gegroepeerd = Array.from(gegroepeerdMap.values()).sort(
    (a, b) => a.sortering - b.sortering
  );

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
          </section>
        ))}
      </div>
    </main>
  );
}