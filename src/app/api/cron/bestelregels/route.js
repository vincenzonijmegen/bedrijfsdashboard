export const runtime = "nodejs";
export const schedule = "0 2 * * *"; // dagelijks om 02:00

import { pool } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const bestellingen = await pool.query(`
    SELECT id, leverancier_id, data, besteld_op
    FROM bestellingen
    WHERE besteld_op >= CURRENT_DATE
  `);

  let totaalRegels = 0;

  for (const b of bestellingen.rows) {
    const bestellingId = b.id;
    const leverancierId = b.leverancier_id;
    const besteldOp = b.besteld_op;
    const regels = b.data ?? {};

    for (const [product_id, aantal] of Object.entries(regels)) {
      if (aantal > 0) {
        await pool.query(
          `INSERT INTO bestelregels (bestelling_id, leverancier_id, product_id, aantal, besteld_op)
           VALUES ($1, $2, $3, $4, $5)`,
          [bestellingId, leverancierId, product_id, aantal, besteldOp]
        );
        totaalRegels++;
      }
    }
  }

  return NextResponse.json({ success: true, regelsToegevoegd: totaalRegels });
}
