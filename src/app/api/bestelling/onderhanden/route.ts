import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

export async function GET(req: NextRequest) {
  const leverancier = req.nextUrl.searchParams.get("leverancier");
  if (!leverancier) return NextResponse.json({ error: "Leverancier vereist" }, { status: 400 });

  const result = await pool.query(
    `SELECT * FROM onderhanden_bestellingen WHERE leverancier_id = $1 ORDER BY laatst_bewerkt DESC LIMIT 1`,
    [leverancier]
  );

  return NextResponse.json(result.rows[0] ?? {});
}


export async function POST(req: NextRequest) {
  const body = await req.json();
  const { leverancier_id, data, referentie } = body;

  if (!leverancier_id || !data) {
    return NextResponse.json({ error: "leverancier_id en data zijn verplicht" }, { status: 400 });
  }

  await pool.query(`
    INSERT INTO onderhanden_bestellingen (leverancier_id, data, referentie, laatst_bewerkt)
    VALUES ($1, $2, $3, now())
    ON CONFLICT (leverancier_id)
    DO UPDATE SET data = $2, referentie = $3, laatst_bewerkt = now()
  `, [leverancier_id, data, referentie]);

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  const leverancier = req.nextUrl.searchParams.get("leverancier");

  if (!id && !leverancier) {
    return NextResponse.json({ error: "id of leverancier vereist" }, { status: 400 });
  }

  if (id) {
    await pool.query(`DELETE FROM onderhanden_bestellingen WHERE id = $1`, [id]);
  } else if (leverancier) {
    await pool.query(`DELETE FROM onderhanden_bestellingen WHERE leverancier_id = $1`, [leverancier]);
  }

  return NextResponse.json({ success: true });
}

