import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type InstructieDebugRow = {
  id: string;
  status: string | null;
  functies: string | null;
};

export async function GET(req: NextRequest) {
  try {
    // Haal ALLE instructies op — ook concept of inactief
    const instrResp = await db.query(`
      SELECT id, status, functies
      FROM instructies
      ORDER BY created_at DESC
      LIMIT 10
    `);

    const instructies = instrResp.rows as InstructieDebugRow[];

    return NextResponse.json({
      instructies: instructies.map((i) => ({
        id: i.id,
        status: i.status,
        functies: i.functies,
      })),
    });
  } catch (err: any) {
    console.error("Fout bij instructie-debug:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
