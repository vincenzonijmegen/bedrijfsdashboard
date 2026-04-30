import Link from "next/link";
import { query } from "@/lib/db";
import { ArrowLeft, Edit3 } from "lucide-react";

export const dynamic = "force-dynamic";

type Taak = {
  id: number;
  naam: string;
  kleurcode: string | null;
  reinigen: boolean;
  desinfecteren: boolean;
  frequentie: string;
  weekdagen: string[] | null;
  sortering: number;
};

function kleurBadge(kleurcode: string | null) {
  if (kleurcode === "roze") {
    return "border-pink-200 bg-pink-50 text-pink-700";
  }

  if (kleurcode === "groen") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (kleurcode === "geel") {
    return "border-yellow-200 bg-yellow-50 text-yellow-800";
  }

  return "border-slate-200 bg-slate-100 text-slate-500";
}

function frequentieLabel(value: string) {
  if (value === "D") return "Dagelijks";
  if (value === "W") return "Wekelijks";
  if (value === "2D") return "Om de 2 dagen";
  return value;
}

export default async function RoutineDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const routineId = Number(id);

  const { rows } = await query<Taak>(
    `
    SELECT id, naam, kleurcode, reinigen, desinfecteren, frequentie, weekdagen, sortering
    FROM routine_taken
    WHERE routine_id = $1
    ORDER BY sortering ASC
    `,
    [routineId]
  );

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                Admin · Routines
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">
                Taken
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Overzicht van alle taken binnen deze routine.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/routines"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Terug
              </Link>

              <Link
                href={`/admin/routines/${routineId}/edit`}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <Edit3 className="h-4 w-4" />
                Bewerken
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-3">
          {rows.map((t) => (
            <div
              key={t.id}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md"
            >
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="text-base font-bold text-slate-900">
                    {t.naam}
                  </div>

                  {t.weekdagen && t.weekdagen.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {t.weekdagen.map((dag) => (
                        <span
                          key={dag}
                          className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600"
                        >
                          {dag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="flex flex-wrap gap-2 md:justify-end">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${kleurBadge(
                      t.kleurcode
                    )}`}
                  >
                    {t.kleurcode ? `Doek: ${t.kleurcode}` : "Geen doek"}
                  </span>

                  <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    {frequentieLabel(t.frequentie)}
                  </span>

                  {t.reinigen ? (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      Reinigen
                    </span>
                  ) : null}

                  {t.desinfecteren ? (
                    <span className="rounded-full border border-purple-200 bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
                      Desinfecteren
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          ))}

          {rows.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
              Nog geen taken gevonden voor deze routine.
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
}