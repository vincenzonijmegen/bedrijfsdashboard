import Link from "next/link";
import { db } from "@/lib/db";

// Zorg dat we altijd live data tonen
export const dynamic = "force-dynamic";

export default async function InstructieOverzicht() {
  const result = await db.query("SELECT slug, titel FROM instructies ORDER BY titel ASC");
  const instructies = result.rows;

  return (
  <div className="p-6 max-w-4xl mx-auto space-y-6">
    <h1 className="text-2xl font-bold">📚 Alle werkinstructies</h1>
    <div className="space-y-2">
      {instructies.map((i) => (
        <Link
          key={i.slug}
          href={`/instructies/${i.slug}`}
          className="block border rounded px-4 py-3 bg-white shadow hover:bg-blue-50"
        >
          {i.titel}
        </Link>
      ))}
    </div>
  </div>
);

}
