import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Medewerker = {
  email: string;
  naam: string;
  kan_scheppen: boolean;
  kan_voorbereiden: boolean;
  kan_ijsbereiden: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const { periode_id } = await req.json();

    if (!periode_id) {
      return NextResponse.json(
        { error: "periode_id ontbreekt" },
        { status: 400 }
      );
    }

    await db.query(`DELETE FROM planning_toewijzingen WHERE periode_id = $1`, [
      periode_id,
    ]);

    const { rows } = await db.query(`
      SELECT
        email,
        naam,
        kan_scheppen,
        kan_voorbereiden,
        kan_ijsbereiden
      FROM medewerkers
    `);

    const medewerkers = rows as Medewerker[];

    const { rows: behoefte } = await db.query(
      `
      SELECT datum, shift_nr, functie, aantal
      FROM planning_shiftbehoefte
      WHERE periode_id = $1
      ORDER BY datum, shift_nr
      `,
      [periode_id]
    );

    const { rows: afwezig } = await db.query(
      `
      SELECT medewerker_email, datum
      FROM planning_afwezigheid
      WHERE periode_id = $1
      `,
      [periode_id]
    );

    const afwezigSet = new Set(
      afwezig.map(
        (a) =>
          `${a.medewerker_email}_${new Date(a.datum).toISOString().slice(0, 10)}`
      )
    );

    const shiftCount: Record<string, number> = {};
    const geplandPerDag = new Set<string>();

    for (const b of behoefte) {
      const datum = new Date(b.datum).toISOString().slice(0, 10);

      for (let i = 0; i < Number(b.aantal || 0); i++) {
        const kandidaten = medewerkers.filter((m) => {
  if (b.functie === "scheppen" && !m.kan_scheppen) return false;
  if (b.functie === "voorbereiden" && !m.kan_voorbereiden) return false;
  if (b.functie === "ijsbereiden" && !m.kan_ijsbereiden) return false;

  if (afwezigSet.has(`${m.email}_${datum}`)) return false;
  if (geplandPerDag.has(`${m.email}_${datum}`)) return false;

  return true;
});

if (kandidaten.length === 0) continue;

// Eerst max 4 proberen
let beschikbareKandidaten = kandidaten.filter(
  (m) => (shiftCount[m.email] || 0) < 4
);

// Als dat niet lukt, max 5 toestaan
if (beschikbareKandidaten.length === 0) {
  beschikbareKandidaten = kandidaten.filter(
    (m) => (shiftCount[m.email] || 0) < 5
  );
}

// Als zelfs dat niet lukt, sla deze plek over
if (beschikbareKandidaten.length === 0) continue;

beschikbareKandidaten.sort(
  (a, b) => (shiftCount[a.email] || 0) - (shiftCount[b.email] || 0)
);

const gekozen = beschikbareKandidaten[0];

        await db.query(
          `
          INSERT INTO planning_toewijzingen
            (periode_id, medewerker_email, datum, shift_nr, functie)
          VALUES ($1, $2, $3::date, $4, $5)
          `,
          [periode_id, gekozen.email, datum, b.shift_nr, b.functie]
        );

        shiftCount[gekozen.email] = (shiftCount[gekozen.email] || 0) + 1;
        geplandPerDag.add(`${gekozen.email}_${datum}`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Fout bij genereren planning:", e);
    return NextResponse.json({ error: "Genereren mislukt" }, { status: 500 });
  }
}