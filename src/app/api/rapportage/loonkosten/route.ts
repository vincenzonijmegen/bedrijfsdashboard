// src/app/api/rapportage/loonkosten/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

type LoonkostenItem = {
  jaar: number;
  maand: number; // 1..12
  lonen: number;
  loonheffing: number;
  pensioenpremie: number;
};

const MAANDEN_SEIZOEN = [3, 4, 5, 6, 7, 8, 9]; // maart..september

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const now = new Date();
    const jaar = Number(url.searchParams.get("jaar") ?? now.getFullYear());

    // Pas namen/kolommen aan jouw tabel aan indien nodig.
    // Variant A: tabel met losse kolommen jaar/maand
    // Variant B: tabel met 'datum' — haal dan jaar/maand via EXTRACT.
    const q = `
      SELECT
        COALESCE(jaar, EXTRACT(YEAR FROM datum)::int)   AS jaar,
        COALESCE(maand, EXTRACT(MONTH FROM datum)::int) AS maand,
        COALESCE(SUM(lonen), 0)                         AS lonen,
        COALESCE(SUM(loonheffing), 0)                   AS loonheffing,
        COALESCE(SUM(pensioenpremie), 0)                AS pensioenpremie
      FROM rapportage.loonkosten
      WHERE COALESCE(jaar, EXTRACT(YEAR FROM datum)::int) = $1
      GROUP BY 1,2
      ORDER BY 1,2;
    `;

    const r = await db.query(q, [jaar]);
    const rows = Array.isArray(r?.rows) ? r.rows : [];

    const fromDb: LoonkostenItem[] = rows.map((x: any) => ({
      jaar: Number(x.jaar ?? jaar),
      maand: Number(x.maand ?? 0),
      lonen: Number(x.lonen ?? 0),
      loonheffing: Number(x.loonheffing ?? 0),
      pensioenpremie: Number(x.pensioenpremie ?? 0),
    }));

    // Maak een map per maand voor snelle merge
    const byMaand = new Map<number, LoonkostenItem>();
    for (const it of fromDb) {
      if (it.maand >= 1 && it.maand <= 12) byMaand.set(it.maand, it);
    }

    // Vul gaten voor maart..september met nulregels
    const gevuld: LoonkostenItem[] = MAANDEN_SEIZOEN.map((m) => {
      const hit = byMaand.get(m);
      return hit ?? { jaar, maand: m, lonen: 0, loonheffing: 0, pensioenpremie: 0 };
    });

    // Optioneel: sorteren op maand
    gevuld.sort((a, b) => a.maand - b.maand);

    return NextResponse.json(gevuld, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    // In geval van fout: geef lege set voor maart..september van het huidige jaar
    const now = new Date();
    const jaar = now.getFullYear();
    const fallback = [3,4,5,6,7,8,9].map((m) => ({
      jaar, maand: m, lonen: 0, loonheffing: 0, pensioenpremie: 0,
    }));
    return NextResponse.json(fallback, { status: 200, headers: { "Cache-Control": "no-store" } });
  }
}
