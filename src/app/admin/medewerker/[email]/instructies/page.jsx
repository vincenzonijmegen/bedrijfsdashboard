import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";

export default function AdminInstructiesPage({ params }) {
  const email = decodeURIComponent(params.email);
  return <InstructieLijst email={email} />;
}

async function InstructieLijst({ email }) {
  const gebruikerResult = await db.query(
    `SELECT naam, functie FROM medewerkers WHERE email = $1`,
    [email]
  );
  const gebruiker = gebruikerResult.rows?.[0];
  if (!gebruiker) return notFound();

  const instructiesResult = await db.query(`
    SELECT id, titel, slug, nummer FROM instructies WHERE status = 'actief'
  `);

  const statusResult = await db.query(
    `SELECT instructie_id FROM gelezen_instructies WHERE email = $1`,
    [email]
  );
  const gelezenIDs = new Set(statusResult.rows.map((r) => r.instructie_id));

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-2">
        📚 Instructies van {gebruiker.naam} ({gebruiker.functie})
      </h1>
      <ul className="space-y-2 mt-4">
        {instructiesResult.rows.map((i) => (
          <li
            key={i.id}
            className="border rounded p-3 bg-white shadow-sm flex justify-between items-center"
          >
            <div>
              <p className="font-semibold">
                {i.nummer ? `${i.nummer}. ` : ""}
                {i.titel}
              </p>
              {gelezenIDs.has(i.id) ? (
                <p className="text-green-600 text-sm">✓ Gelezen</p>
              ) : (
                <p className="text-gray-400 text-sm">Nog niet gelezen</p>
              )}
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
