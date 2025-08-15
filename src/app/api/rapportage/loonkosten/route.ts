import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
import { startTimer } from "@/lib/timing";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const timer = startTimer("/api/rapportage/loonkosten");
  try {
    const jaar =
      parseInt(req.nextUrl.searchParams.get("jaar") || "", 10) ||
      new Date().getFullYear();

    const { rows } = await pool.query(
      `SELECT
         maand,
         COALESCE(lonen,0)::bigint          AS lonen,
         COALESCE(loonheffing,0)::bigint    AS loonheffing,
         COALESCE(pensioenpremie,0)::bigint AS pensioenpremie
       FROM rapportage.loonkosten
       WHERE jaar = $1
       ORDER BY maand`,
      [jaar]
    );

    // vul 1..12
    const map = new Map<number, { maand: number; lonen: number; loonheffing: number; pensioenpremie: number }>();
    for (const r of rows) {
      map.set(Number(r.maand), {
        maand: Number(r.maand),
        lonen: Number(r.lonen),
        loonheffing: Number(r.loonheffing),
        pensioenpremie: Number(r.pensioenpremie),
      });
    }
    const maanden = Array.from({ length: 12 }, (_, i) => {
      const m = i + 1;
      return map.get(m) ?? { maand: m, lonen: 0, loonheffing: 0, pensioenpremie: 0 };
    });

    // ⬅️ Belangrijk: wrapper zodat de frontend niet wegfiltert
    return NextResponse.json({ jaar, maanden });
  } catch (err) {
    console.error("Fout bij ophalen loonkosten:", err);
    return NextResponse.json({ error: "Interne serverfout" }, { status: 500 });
  } finally {
    timer.end({ hint: "loonkosten" });
  }
}

export async function POST(req: Request) {
  const { jaar, maand, lonen = 0, loonheffing = 0, pensioenpremie = 0 } = await req.json();
  if (!jaar || !maand) {
    return NextResponse.json({ error: "Jaar en maand verplicht" }, { status: 400 });
  }

  await pool.query(
    `INSERT INTO rapportage.loonkosten (jaar, maand, lonen, loonheffing, pensioenpremie)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (jaar, maand) DO UPDATE SET
       lonen = EXCLUDED.lonen,
       loonheffing = EXCLUDED.loonheffing,
       pensioenpremie = EXCLUDED.pensioenpremie;`,
    [jaar, maand, lonen, loonheffing, pensioenpremie]
  );

  return NextResponse.json({ success: true });
}
