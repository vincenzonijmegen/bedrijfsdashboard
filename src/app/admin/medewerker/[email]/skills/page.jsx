import { db } from "@/lib/db";
import { notFound } from "next/navigation";

export default function AdminSkillsPage({ params }) {
  const email = decodeURIComponent(params.email);
  return <ReadonlySkills email={email} />;
}

async function ReadonlySkills({ email }) {
  const { rows: medewerkerRows } = await db.query(
    `SELECT id, naam, functie FROM medewerkers WHERE email = $1`,
    [email]
  );
  const medewerker = medewerkerRows?.[0];
  if (!medewerker) return notFound();

  const { rows } = await db.query(`
    SELECT
      s.id AS skill_id,
      s.naam AS skill_naam,
      sc.naam AS categorie,
      ss.status,
      s.beschrijving AS omschrijving,
      CURRENT_DATE + (st.deadline_dagen || ' days')::interval AS deadline
    FROM skill_toegewezen st
    JOIN skills s ON st.skill_id = s.id
    LEFT JOIN skill_status ss ON ss.skill_id = s.id AND ss.medewerker_id = st.medewerker_id
    LEFT JOIN skill_categorieen sc ON sc.id = s.categorie_id
    WHERE st.medewerker_id = $1
    ORDER BY sc.naam, s.naam
  `, [medewerker.id]);

  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">
        🧠 Skill-overzicht van {medewerker.naam} ({medewerker.functie})
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {rows.length === 0 ? (
          <p className="text-gray-600 col-span-2">Geen skills gevonden.</p>
        ) : (
          rows.map((s) => {
            const status = s.status === "geleerd" ? "geleerd" : "niet_geleerd";
            const statusKleur =
              status === "geleerd"
                ? "text-green-700 font-semibold"
                : "text-gray-500 italic";
            const statusLabel =
              status === "geleerd" ? "✅ Geleerd" : "🕐 Nog niet geleerd";

            const kleur =
              status === "geleerd"
                ? "bg-gray-200"
                : s.deadline
                ? new Date(s.deadline) < new Date()
                  ? "bg-red-200"
                  : "bg-yellow-200"
                : "bg-green-200";

            return (
              <div
                key={s.skill_id}
                className={`rounded-lg shadow px-4 py-3 border ${kleur}`}
                title={s.omschrijving || ""}
              >
                <div className="font-semibold text-slate-800 mb-1">{s.skill_naam}</div>
                <div className="text-sm text-slate-700 mb-1 italic">
                  Categorie: {s.categorie || "–"}
                </div>
                {s.deadline && (
                  <div className="text-sm text-orange-700 mb-1">
                    🗓 Deadline: {new Date(s.deadline).toLocaleDateString("nl-NL")}
                  </div>
                )}
                <div className={`text-sm ${statusKleur}`}>{statusLabel}</div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
