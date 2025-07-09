import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type InstructieRow = { id: string; functies: string | null };

export async function GET(req: NextRequest) {
  try {
    // Alleen deze debugversie, dus medewerkers en skills zijn tijdelijk weggelaten

    // Actieve instructies ophalen
    const instrResp = await db.query(`
      SELECT id, functies
      FROM instructies
      WHERE status = 'actief'
    `);
    const alleInstructies = instrResp.rows as InstructieRow[];

    // Debug: toon voorbeeldwaarden van 'functies'-veld
    return NextResponse.json({
      voorbeeldFuncties: alleInstructies.map((i) => i.functies).slice(0, 10),
    });

  } catch (err: any) {
    console.error("Fout bij ophalen functies-debug:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
