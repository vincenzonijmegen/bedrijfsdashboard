// src/app/api/admin/instructiestatus/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyJWT } from "@/lib/auth";

const TOEGESTANE_LEESROLLEN = ["beheerder", "accountant"];

async function magLezen(req: NextRequest) {
  try {
    const gebruikerJWT = verifyJWT(req);

    const result = await db.query(
      `SELECT rol
       FROM medewerkers
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [gebruikerJWT.email]
    );

    const gebruiker = result.rows[0];

    if (!gebruiker) {
      return false;
    }

    const rol = String(gebruiker.rol || "").toLowerCase();

    return TOEGESTANE_LEESROLLEN.includes(rol);
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  try {
    const toegestaan = await magLezen(req);

    if (!toegestaan) {
      return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
    }

    const { rows } = await db.query(
      `SELECT email, gelezen_op, score, totaal, juist
       FROM instructiestatus`
    );

    return NextResponse.json(rows);
  } catch (err) {
    console.error("❌ Fout bij ophalen admin instructiestatus:", err);

    return NextResponse.json(
      { error: "Ophalen instructiestatus mislukt." },
      { status: 500 }
    );
  }
}