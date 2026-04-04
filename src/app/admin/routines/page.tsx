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
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Routines</h1>

      <div className="space-y-2">
        {rows.map((r) => (
          <Link
            key={r.id}
            href={`/admin/routines/${r.id}`}
            className="block p-4 border rounded hover:bg-gray-50"
          >
            <div className="font-medium">{r.naam}</div>
            <div className="text-sm text-gray-500">
              {r.locatie} • {r.type}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}