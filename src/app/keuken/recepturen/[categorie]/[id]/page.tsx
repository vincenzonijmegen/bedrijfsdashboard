import Link from "next/link";
import { query } from "@/lib/db";

type Ingredient = {
  naam: string;
  gewicht: string;
};

type Recept = {
  id: number;
  naam: string;
  hoeveelheid_mix: string | null;
  maakinstructie: string | null;
};

function splitStappen(maakinstructie: string | null) {
  if (!maakinstructie) return [];
  return maakinstructie
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export default async function ReceptDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; categorie: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id, categorie } = await params;
  const { from } = await searchParams;

  const terugHref =
    from === "maaklijst"
      ? "/keuken/maaklijst"
      : `/keuken/recepturen/${categorie}`;

  const terugLabel =
    from === "maaklijst"
      ? "← Terug naar maaklijst"
      : `← Terug naar ${categorie.replace(/-/g, " ")}`;

  const receptResult = await query<Recept>(
    `
    SELECT
      id,
      naam,
      hoeveelheid_mix,
      maakinstructie
    FROM keuken_recepten
    WHERE id = $1
    LIMIT 1
    `,
    [id]
  );

  const recept = receptResult.rows[0];

  if (!recept) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-4xl">
          <Link
            href={terugHref}
            className="mb-6 inline-flex items-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-700 shadow-sm"
          >
            {terugLabel}
          </Link>

          <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-lg text-slate-500">
            Recept niet gevonden.
          </div>
        </div>
      </main>
    );
  }

  const ingrediëntenResult = await query<Ingredient>(
    `
    SELECT naam, gewicht
    FROM keuken_recept_ingredienten
    WHERE recept_id = $1
    ORDER BY volgorde ASC
    `,
    [id]
  );

  const ingredienten = ingrediëntenResult.rows;
  const stappen = splitStappen(recept.maakinstructie);

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <Link
          href={terugHref}
          className="mb-6 inline-flex items-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-700 shadow-sm"
        >
          {terugLabel}
        </Link>

        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm md:p-8">
          <div className="border-b border-slate-200 pb-6">
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              Receptuur
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
              {recept.naam}
            </h1>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <section className="rounded-3xl bg-slate-50 p-5 md:p-6">
              <h2 className="text-2xl font-bold text-slate-900">
                Benodigdheden
              </h2>

              {ingredienten.length === 0 ? (
                <p className="mt-4 text-base italic text-slate-400">
                  Geen benodigdheden ingevuld.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {ingredienten.map((ing, index) => (
                    <li
                      key={`${ing.naam}-${index}`}
                      className="flex items-start justify-between gap-4 rounded-2xl bg-white px-4 py-4 text-lg shadow-sm"
                    >
                      <span className="font-medium text-slate-800">
                        {ing.naam}
                      </span>
                      <span className="whitespace-nowrap font-semibold text-slate-900">
                        {ing.gewicht}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-3xl bg-slate-50 p-5 md:p-6">
              <h2 className="text-2xl font-bold text-slate-900">Werkwijze</h2>

              {stappen.length === 0 ? (
                <p className="mt-4 text-lg text-slate-500">
                  Geen werkwijze ingevuld.
                </p>
              ) : (
                <ol className="mt-4 space-y-4">
                  {stappen.map((stap, index) => (
                    <li
                      key={index}
                      className="flex gap-4 rounded-2xl bg-white px-4 py-4 shadow-sm"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-lg font-bold text-white">
                        {index + 1}
                      </div>
                      <div className="pt-1 text-lg leading-relaxed text-slate-800">
                        {stap.replace(/^\d+\.\s*/, "")}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}