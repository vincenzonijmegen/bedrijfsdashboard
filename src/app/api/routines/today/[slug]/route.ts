import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TaakRow = {
  id: number;
  naam: string;
  kleurcode: "roze" | "groen" | "geel" | null;
  reinigen: boolean;
  desinfecteren: boolean;
  frequentie: "D" | "W" | "2D";
  weekdagen: string[] | null;
  sortering: number;
  afgetekend_door_naam: string | null;
  afgetekend_op: string | null;
};

const WEEKDAGEN = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const ISO_EVEN_REFERENCE = new Date("2026-01-05T00:00:00"); // maandag

function isZelfdeDag(date: Date, ref: Date) {
  return date.toISOString().slice(0, 10) === ref.toISOString().slice(0, 10);
}

function dagenVerschil(a: Date, b: Date) {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcA - utcB) / 86400000);
}

function taakIsVandaagZichtbaar(taak: TaakRow, vandaag: Date) {
  const weekdagen = Array.isArray(taak.weekdagen) ? taak.weekdagen : [];
  const vandaagCode = WEEKDAGEN[vandaag.getDay()];

  if (weekdagen.length > 0 && !weekdagen.includes(vandaagCode)) {
    return false;
  }

  if (taak.frequentie === "2D") {
    return dagenVerschil(vandaag, ISO_EVEN_REFERENCE) % 2 === 0;
  }

  return true;
}

export async function GET(_req: NextRequest, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const datum = new Date();
    const vandaag = datum.toISOString().slice(0, 10);

    const routineResult = await db.query(
      `SELECT id, slug, naam, locatie, type
       FROM routines
       WHERE slug = $1 AND actief = true
       LIMIT 1`,
      [slug]
    );

    if (routineResult.rowCount === 0) {
      return NextResponse.json({ error: "Routine niet gevonden" }, { status: 404 });
    }

    const routine = routineResult.rows[0];

    const takenResult = await db.query(
      `SELECT
         t.id,
         t.naam,
         t.kleurcode,
         t.reinigen,
         t.desinfecteren,
         t.frequentie,
         COALESCE(t.weekdagen, '[]'::jsonb) AS weekdagen,
         t.sortering,
         a.afgetekend_door_naam,
         a.afgetekend_op
       FROM routine_taken t
       LEFT JOIN routine_aftekeningen a
         ON a.routine_taak_id = t.id
        AND a.datum = $2::date
       WHERE t.routine_id = $1
         AND t.actief = true
       ORDER BY t.sortering ASC, t.id ASC`,
      [routine.id, vandaag]
    );

    const alleTaken = takenResult.rows as TaakRow[];
    const zichtbareTaken = alleTaken.filter((taak) => taakIsVandaagZichtbaar(taak, datum));

    return NextResponse.json({
      datum: vandaag,
      routine,
      taken: zichtbareTaken,
      totaal: zichtbareTaken.length,
      afgerond: zichtbareTaken.filter((taak) => Boolean(taak.afgetekend_op)).length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Fout bij ophalen routine", details: String(error) },
      { status: 500 }
    );
  }
}
