import { query } from "@/lib/db";

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
  params: Promise<{ ID: string }>;
}) {
  const { ID } = await params;
  const routineId = Number(ID);

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
      <h1 className="text-2xl font-semibold mb-4">Taken</h1>

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