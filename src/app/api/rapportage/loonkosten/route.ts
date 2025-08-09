import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

// GET /api/loonkosten            -> alle rijen (bestaand gedrag)
// GET /api/loonkosten?jaar=2025  -> { jaar, maanden: [{maand, lonen, loonheffing, pensioenpremie}] }
export async function GET(req: NextRequest) {
  const jaarParam = req.nextUrl.searchParams.get("jaar");
  const jaar = jaarParam ? parseInt(jaarParam, 10) : null;

  if (!jaar) {
    const result = await pool.query(`
      SELECT jaar, maand, lonen, loonheffing, pensioenpremie
      FROM rapportage.loonkosten
      ORDER BY jaar, maand;
    `);
    return NextResponse.json(result.rows);
  }

  const { rows } = await pool.query(
    `SELECT maand, lonen, loonheffing, pensioenpremie
     FROM rapportage.loonkosten
     WHERE jaar = $1
     ORDER BY maand`,
    [jaar]
  );

  // 12 maanden garanderen
  const map = new Map<number, { maand: number; lonen: number; loonheffing: number; pensioenpremie: number }>();
  rows.forEach(r =>
    map.set(Number(r.maand), {
      maand: Number(r.maand),
      lonen: Number(r.lonen ?? 0),
      loonheffing: Number(r.loonheffing ?? 0),
      pensioenpremie: Number(r.pensioenpremie ?? 0),
    })
  );

  const maanden = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    return (
      map.get(m) ?? { maand: m, lonen: 0, loonheffing: 0, pensioenpremie: 0 }
    );
  });

  return NextResponse.json({ jaar, maanden });
}

// POST (bestaand): upsert volledige rij voor één maand
export async function POST(req: Request) {
  const { jaar, maand, lonen = 0, loonheffing = 0, pensioenpremie = 0 } = await req.json();

  if (!jaar || !maand) {
    return NextResponse.json({ error: "Jaar en maand verplicht" }, { status: 400 });
  }

  await pool.query(
    `INSERT INTO rapportage.loonkosten (jaar, maand, lonen, loonheffing, pensioenpremie)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (jaar, maand)
     DO UPDATE SET
       lonen = EXCLUDED.lonen,
       loonheffing = EXCLUDED.loonheffing,
       pensioenpremie = EXCLUDED.pensioenpremie;`,
    [jaar, maand, lonen, loonheffing, pensioenpremie]
  );

  return NextResponse.json({ success: true });
}

// PATCH (nieuw, handig voor inline edit van één veld)
export async function PATCH(req: Request) {
  const body = await req.json();
  const { jaar, maand } = body;

  if (!jaar || !maand) {
    return NextResponse.json({ error: "Jaar en maand verplicht" }, { status: 400 });
  }

  // Dynamisch SET opbouwen: alleen meegestuurde velden updaten (ook 0-waarden)
  const toUpdate: string[] = [];
  const values: any[] = [jaar, maand];
  let idx = 3 as number;

  (["lonen", "loonheffing", "pensioenpremie"] as const).forEach((k) => {
    if (typeof body[k] !== "undefined") {
      toUpdate.push(`${k} = $${idx++}`);
      values.push(body[k]);
    }
  });

  if (toUpdate.length === 0) {
    return NextResponse.json({ error: "Geen velden om bij te werken" }, { status: 400 });
  }

  const sql = `
    INSERT INTO rapportage.loonkosten (jaar, maand, ${toUpdate.map(s => s.split(" = ")[0]).join(", ")})
    VALUES ($1, $2, ${toUpdate.map((_, i) => `$${i + 3}`).join(", ")})
    ON CONFLICT (jaar, maand) DO UPDATE SET
      ${toUpdate.join(", ")}
    RETURNING jaar, maand, lonen, loonheffing, pensioenpremie
  `;

  const { rows } = await pool.query(sql, values);
  return NextResponse.json(rows[0]);
}
