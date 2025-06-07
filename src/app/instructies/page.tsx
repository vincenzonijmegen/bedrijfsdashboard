import Link from "next/link";
import { db } from "@/lib/db";

export default async function InstructieOverzicht() {
  const result = await db.query("SELECT slug, titel FROM instructies ORDER BY titel ASC");
  const instructies = result.rows;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">📚 Alle werkinstructies</h1>
      <ul className="space-y-2">
        {instructies.map((i: { slug: string; titel: string }) => (
          <li key={i.slug}>
            <Link
              href={`/instructies/${i.slug}`}
              className="text-blue-600 underline hover:text-blue-800"
            >
              {i.titel}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
