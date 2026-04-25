// src/app/api/admin/haccp/leiding-aftekenen/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const routineTaakId = Number(body?.routineTaakId);
    const datum = String(body?.datum || "").trim();
    const leidinggevendeId = Number(body?.leidinggevendeId);
    const status = String(body?.status || "gedaan"); // gedaan | overgeslagen
    const reden = String(body?.reden || "").trim();

    // 🔒 Validatie
    if (!routineTaakId || !datum || !leidinggevendeId) {
      return NextResponse.json(
        { success: false, error: "Ontbrekende velden" },
        { status: 400 }
      );
    }

    if (!["gedaan", "overgeslagen"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "Ongeldige status" },
        { status: 400 }
      );
    }

    if (status === "overgeslagen" && !reden) {
      return NextResponse.json(
        { success: false, error: "Reden verplicht bij overslaan" },
        { status: 400 }
      );
    }

    // 🔍 Check of taak al is afgetekend
    const existing = await db.query(
      `
      SELECT id
      FROM routine_aftekeningen
      WHERE routine_taak_id = $1
        AND datum = $2::date
      LIMIT 1
      `,
      [routineTaakId, datum]
    );

    if (existing.rowCount && existing.rows[0]?.id) {
      return NextResponse.json(
        { success: false, error: "Taak is al afgetekend" },
        { status: 400 }
      );
    }

    // 🔍 Haal naam leidinggevende op
    const leiding = await db.query(
      `
      SELECT naam
      FROM leidinggevenden
      WHERE id = $1
        AND actief = true
      LIMIT 1
      `,
      [leidinggevendeId]
    );

    if (!leiding.rowCount) {
      return NextResponse.json(
        { success: false, error: "Leidinggevende niet gevonden" },
        { status: 404 }
      );
    }

    const naam = leiding.rows[0].naam;

    // 💾 Insert
    await db.query(
      `
      INSERT INTO routine_aftekeningen (
        routine_taak_id,
        datum,
        afgetekend_door_shiftbase_user_id,
        afgetekend_door_naam,
        afgetekend_op,
        status,
        bron,
        leidinggevende_id,
        overgeslagen_reden
      )
      VALUES (
        $1,
        $2::date,
        NULL,
        $3,
        NOW(),
        $4,
        'leiding',
        $5,
        $6
      )
      `,
      [
        routineTaakId,
        datum,
        naam,
        status,
        leidinggevendeId,
        status === "overgeslagen" ? reden : null,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Fout bij leiding aftekenen:", error);

    return NextResponse.json(
      { success: false, error: "Serverfout" },
      { status: 500 }
    );
  }
}