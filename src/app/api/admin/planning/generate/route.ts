import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Medewerker = {
  email: string;
  naam: string;
  geboortedatum: string | null;
  kan_scheppen: boolean;
  kan_voorbereiden: boolean;
  kan_ijsbereiden: boolean;
};

function berekenLeeftijd(datum: string | null): number {
  if (!datum) return 99;

  const d = new Date(datum);
  const now = new Date();

  let leeftijd = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();

  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) {
    leeftijd--;
  }

  return leeftijd;
}

export async function POST(req: NextRequest) {
  try {
    const { periode_id } = await req.json();

    if (!periode_id) {
      return NextResponse.json({ error: "periode_id ontbreekt" }, { status: 400 });
    }

    // alles leeggooien
    await db.query(
      `DELETE FROM planning_toewijzingen WHERE periode_id = $1`,
      [periode_id]
    );

    const { rows } = await db.query(`
  SELECT email, naam, geboortedatum,
    kan_scheppen,
    kan_voorbereiden,
    kan_ijsbereiden
  FROM medewerkers
`);

const medewerkers = rows as Medewerker[];

    const { rows: behoefte } = await db.query(`
      SELECT datum, shift_nr, functie, aantal
      FROM planning_shiftbehoefte
      WHERE periode_id = $1
      ORDER BY datum, shift_nr
    `, [periode_id]);

    const { rows: afwezig } = await db.query(`
      SELECT medewerker_email, datum
      FROM planning_afwezigheid
      WHERE periode_id = $1
    `, [periode_id]);

    const afwezigSet = new Set(
      afwezig.map((a: any) => `${a.medewerker_email}_${a.datum.toISOString().slice(0,10)}`)
    );

    const shiftCount: Record<string, number> = {};

    for (const b of behoefte) {
      const datum = b.datum.toISOString().slice(0, 10);

      for (let i = 0; i < b.aantal; i++) {
        // kandidaten filteren
        const kandidaten = medewerkers.filter((m) => {
          // leeftijd check tijdelijk uit

          if (b.functie === "scheppen" && !m.kan_scheppen) return false;
          if (b.functie === "voorbereiden" && !m.kan_voorbereiden) return false;
          if (b.functie === "ijsbereiden" && !m.kan_ijsbereiden) return false;

          if (afwezigSet.has(`${m.email}_${datum}`)) return false;

          return true;
        });

        if (kandidaten.length === 0) continue;

        // sorteer op minst aantal shifts
        kandidaten.sort((a, b) => {
          return (shiftCount[a.email] || 0) - (shiftCount[b.email] || 0);
        });

        const gekozen = kandidaten[0];

        await db.query(
          `
          INSERT INTO planning_toewijzingen
          (periode_id, medewerker_email, datum, shift_nr, functie)
          VALUES ($1, $2, $3::date, $4, $5)
          `,
          [periode_id, gekozen.email, datum, b.shift_nr, b.functie]
        );

        shiftCount[gekozen.email] = (shiftCount[gekozen.email] || 0) + 1;
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Genereren mislukt" }, { status: 500 });
  }
}