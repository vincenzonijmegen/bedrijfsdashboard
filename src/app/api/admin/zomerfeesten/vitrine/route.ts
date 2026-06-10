import { db, pool } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type VitrineNaam = "links" | "midden" | "rechts";

type PositieInput = {
  vitrine?: string | null;
  positie?: number | string | null;
  smaakcode?: string | null;
};

const geldigeVitrine = (waarde: unknown): waarde is VitrineNaam =>
  waarde === "links" || waarde === "midden" || waarde === "rechts";

const normaleSmaakcode = (waarde: unknown) => {
  if (waarde === null || waarde === undefined) return null;
  const tekst = String(waarde).trim().toUpperCase();
  return tekst || null;
};

export async function GET(req: NextRequest) {
  const planningId = Number(req.nextUrl.searchParams.get("planning_id") || 0);

  if (!planningId) {
    return NextResponse.json({ error: "planning_id ontbreekt" }, { status: 400 });
  }

  try {
    const result = await db.query(
      `SELECT planning_id, vitrine, positie, smaakcode
       FROM zomerfeesten_vitrine_indeling
       WHERE planning_id = $1
       ORDER BY vitrine, positie`,
      [planningId],
    );

    return NextResponse.json({ posities: result.rows });
  } catch (err) {
    console.error("Fout bij ophalen vitrine-indeling:", err);
    return NextResponse.json({ error: "Databasefout" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const client = await pool.connect();

  try {
    const body = await req.json();
    const planningId = Number(body.planning_id || 0);
    const posities: PositieInput[] = Array.isArray(body.posities) ? body.posities : [];

    if (!planningId) {
      return NextResponse.json({ error: "planning_id ontbreekt" }, { status: 400 });
    }

    await client.query("BEGIN");

    await client.query(
      `DELETE FROM zomerfeesten_vitrine_indeling WHERE planning_id = $1`,
      [planningId],
    );

    for (const positie of posities) {
      const vitrine = positie.vitrine;
      const nummer = Number(positie.positie || 0);

      if (!geldigeVitrine(vitrine) || nummer < 1 || nummer > 14) continue;

      await client.query(
        `INSERT INTO zomerfeesten_vitrine_indeling
         (planning_id, vitrine, positie, smaakcode, bijgewerkt_op)
         VALUES ($1, $2, $3, $4, now())`,
        [planningId, vitrine, nummer, normaleSmaakcode(positie.smaakcode)],
      );
    }

    await client.query("COMMIT");

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Fout bij opslaan vitrine-indeling:", err);
    return NextResponse.json({ error: "Serverfout" }, { status: 500 });
  } finally {
    client.release();
  }
}
