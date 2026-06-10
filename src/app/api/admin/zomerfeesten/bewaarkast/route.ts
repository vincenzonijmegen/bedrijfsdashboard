import { db, pool } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BewaarkastNaam = "links" | "midden" | "rechts";

type PositieInput = {
  bewaarkast?: string | null;
  schap?: number | string | null;
  smaakcode?: string | null;
  aantal_bakken?: number | string | null;
};

const geldigeBewaarkast = (waarde: unknown): waarde is BewaarkastNaam =>
  waarde === "links" || waarde === "midden" || waarde === "rechts";

const normaleSmaakcode = (waarde: unknown) => {
  if (waarde === null || waarde === undefined) return null;
  const tekst = String(waarde).trim().toUpperCase();
  return tekst || null;
};

export async function GET(req: NextRequest) {
  const planningId = Number(req.nextUrl.searchParams.get("planning_id") || 0);

  if (!planningId) {
    return NextResponse.json(
      { error: "planning_id ontbreekt" },
      { status: 400 },
    );
  }

  try {
    const result = await db.query(
      `SELECT planning_id, bewaarkast, schap, smaakcode, aantal_bakken
       FROM zomerfeesten_bewaarkast_indeling
       WHERE planning_id = $1
       ORDER BY bewaarkast, schap`,
      [planningId],
    );

    return NextResponse.json({ posities: result.rows });
  } catch (err) {
    console.error("Fout bij ophalen bewaarkastindeling:", err);
    return NextResponse.json({ error: "Databasefout" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const client = await pool.connect();

  try {
    const body = await req.json();
    const planningId = Number(body.planning_id || 0);
    const posities: PositieInput[] = Array.isArray(body.posities)
      ? body.posities
      : [];

    if (!planningId) {
      return NextResponse.json(
        { error: "planning_id ontbreekt" },
        { status: 400 },
      );
    }

    await client.query("BEGIN");

    await client.query(
      `DELETE FROM zomerfeesten_bewaarkast_indeling WHERE planning_id = $1`,
      [planningId],
    );

    for (const positie of posities) {
      const bewaarkast = positie.bewaarkast;
      const schap = Number(positie.schap || 0);
      const smaakcode = normaleSmaakcode(positie.smaakcode);
      const aantalBakken = Math.max(0, Number(positie.aantal_bakken || 0));

      if (!geldigeBewaarkast(bewaarkast) || schap < 1 || schap > 6) continue;

      await client.query(
        `INSERT INTO zomerfeesten_bewaarkast_indeling
         (planning_id, bewaarkast, schap, smaakcode, aantal_bakken, bijgewerkt_op)
         VALUES ($1, $2, $3, $4, $5, now())`,
        [planningId, bewaarkast, schap, smaakcode, aantalBakken],
      );
    }

    await client.query("COMMIT");

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Fout bij opslaan bewaarkastindeling:", err);
    return NextResponse.json({ error: "Serverfout" }, { status: 500 });
  } finally {
    client.release();
  }
}
