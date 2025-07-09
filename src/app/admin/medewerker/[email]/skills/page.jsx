import { db } from "@/lib/db";
import { notFound } from "next/navigation";

export default function AdminSkillsPage({ params }) {
  const email = decodeURIComponent(params.email);
  return <SkillsLijst email={email} />;
}

async function SkillsLijst({ email }) {
  const gebruikerResult = await db.query(
    `SELECT naam, functie FROM medewerkers WHERE email = $1`,
    [email]
  );
  const gebruiker = gebruikerResult.rows?.[0];
  if (!gebruiker) return notFound();

  const toegewezen = await db.query(
    `SELECT s.naam, sc.naam AS categorie, st.deadline_dagen, st.toegewezen_op, s.id
     FROM skill_toegewezen st
     JOIN skills s ON st.skill_id = s.id
     LEFT JOIN skill_categorieen sc ON s.categorie_id = sc.id
     WHERE st.medewerker_id = (SELECT id FROM medewerkers WHERE email = $1)`,
    [email]
  );

  const status = await db.query(
    `SELECT skill_id FROM skill_status WHERE medewerker_id = (SELECT id FROM medewerkers WHERE email = $1)`,
    [email]
  );
  const geleerdeIDs = new Set(status.rows.map((r) => r.skill_id));

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">
        🧠 Skills van {gebruiker.naam} ({gebruiker.functie})
      </h1>

      {toegewezen.rows.length === 0 ? (
        <p className="text-gray-600">Geen skills toegewezen.</p>
      ) : (
        <ul className="space-y-3">
          {toegewezen.rows.map((s, i) => {
            const deadline = s.deadline_dagen
              ? new Date(
                  new Date(s.toegewezen_op).getTime() + s.deadline_dagen * 86400000
                )
              : null;
            const verlopen = deadline && deadline.getTime() < Date.now();
            const geleerd = geleerdeIDs.has(s.id);

            return (
              <li
                key={i}
                className={`p-3 rounded border ${
                  geleerd
                    ? "bg-green-50"
                    : verlopen
                    ? "bg-red-50"
                    : "bg-white"
                }`}
              >
                <div className="flex justify-between">
                  <div>
                    <p className="font-semibold">{s.naam}</p>
                    <p className="text-sm text-gray-500">{s.categorie}</p>
                  </div>
                  <div className="text-sm text-right">
                    {geleerd ? (
                      <p className="text-green-600">✓ Geleerd</p>
                    ) : deadline ? (
                      <p className={verlopen ? "text-red-600" : "text-orange-600"}>
                        Deadline: {deadline.toLocaleDateString("nl-NL")}
                      </p>
                    ) : (
                      <p className="text-gray-400">Nog niet geleerd</p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
