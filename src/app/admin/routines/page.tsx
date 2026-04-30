import Link from "next/link";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

type Routine = {
  id: number;
  naam: string;
  locatie: string;
  type: string;
  actief: boolean;
};

export default async function AdminRoutinesPage() {
  const { rows } = await query<Routine>(`
    SELECT id, naam, locatie, type, actief
    FROM routines
    ORDER BY locatie, type, naam
  `);

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              Routines
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Overzicht van alle HACCP & werk routines
            </p>
          </div>

          <Link
            href="/admin/routines/nieuw"
            className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition"
          >
            + Nieuwe routine
          </Link>
        </div>
      </div>

      {/* Lijst */}
      <div className="grid gap-3">
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`/admin/routines/${r.id}`}
            className="group bg-white rounded-2xl border border-slate-200 shadow-sm p-4 hover:border-blue-300 hover:shadow-md transition"
          >
            <div className="flex items-center justify-between">
              {/* Linkerkant */}
              <div>
                <div className="text-base font-semibold text-slate-900 group-hover:text-blue-700 transition">
                  {r.naam}
                </div>

                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {/* Locatie badge */}
                  <span className="text-xs px-2 py-1 rounded-lg bg-slate-100 text-slate-600">
                    {r.locatie}
                  </span>

                  {/* Type badge */}
                  <span className="text-xs px-2 py-1 rounded-lg bg-slate-100 text-slate-600">
                    {r.type}
                  </span>

                  {/* Status */}
                  {r.actief ? (
                    <span className="text-xs px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700">
                      Actief
                    </span>
                  ) : (
                    <span className="text-xs px-2 py-1 rounded-lg bg-slate-200 text-slate-500">
                      Inactief
                    </span>
                  )}
                </div>
              </div>

              {/* Rechterkant */}
              <div className="text-slate-400 group-hover:text-blue-600 transition text-sm">
                →
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Empty state */}
      {rows.length === 0 && (
        <div className="mt-6 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center text-slate-500">
          Geen routines gevonden.
        </div>
      )}
    </div>
  );
}