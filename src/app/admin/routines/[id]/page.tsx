import Link from "next/link";
import { query } from "@/lib/db";

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
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Taken</h1>
        <Link
          href={`/admin/routines/${routineId}/edit`}
          className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
        >
          Bewerken
        </Link>
      </div>

      <div className="space-y-2">
        {rows.map((t) => (
          <div key={t.id} className="p-3 border rounded">
            <div className="font-medium">{t.naam}</div>

            <div className="text-sm text-gray-500">
              {t.kleurcode && <>Doek: {t.kleurcode} • </>}
              {t.reinigen && "Reinigen • "}
              {t.desinfecteren && "Desinfecteren • "}
              {t.frequentie}
            </div>

            {t.weekdagen && t.weekdagen.length > 0 && (
              <div className="text-xs text-gray-400">
                Dagen: {t.weekdagen.join(", ")}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}