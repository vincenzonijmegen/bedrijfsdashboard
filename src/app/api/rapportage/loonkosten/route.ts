// src/app/api/rapportage/loonkosten/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Vorm van één item zoals de frontend verwacht
type LoonkostenItem = {
  jaar: number;
  maand: number; // 1..12
  lonen: number;
  loonheffing: number;
  pensioenpremie: number;
};

export async function GET() {
  try {
    // Pas de query aan je echte tabel/kolomnamen aan indien nodig.
    // Doel: ALTIJD (jaar, maand, lonen, loonheffing, pensioenpremie) per maand retourneren.
    const q = `
      SELECT
        COALESCE(jaar, EXTRACT(YEAR FROM datum)::int)    AS jaar,
        COALESCE(maand, EXTRACT(MONTH FROM datum)::int)  AS maand,
        COALESCE(SUM(lonen), 0)                          AS lonen,
        COALESCE(SUM(loonheffing), 0)                    AS loonheffing,
        COALESCE(SUM(pensioenpremie), 0)                 AS pensioenpremie
      FROM rapportage.loonkosten
      GROUP BY 1,2
      ORDER BY 1,2;
    `;

    const r = await db.query(q);

    // BRON-FIX: normaliseer en typ-cast naar numbers, en GARANDEER een array.
    const rows = Array.isArray(r?.rows) ? r.rows : [];
    const data: LoonkostenItem[] = rows.map((x: any) => ({
      jaar: Number(x.jaar ?? 0),
      maand: Number(x.maand ?? 0),
      lonen: Number(x.lonen ?? 0),
      loonheffing: Number(x.loonheffing ?? 0),
      pensioenpremie: Number(x.pensioenpremie ?? 0),
    }));

    // Extra zekerheid: filter alleen geldige maanden 1..12
    const clean = data.filter(d =>
      Number.isFinite(d.jaar) &&
      d.maand >= 1 && d.maand <= 12 &&
      [d.lonen, d.loonheffing, d.pensioenpremie].every(Number.isFinite)
    );

    return NextResponse.json(clean, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    // In geval van DB-fout: geef een lege array i.p.v. object zodat de UI nooit crasht
    return NextResponse.json([], { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}
