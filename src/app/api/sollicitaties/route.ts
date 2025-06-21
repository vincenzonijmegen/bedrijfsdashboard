// app/api/sollicitaties/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db"; // Zorg dat dit naar jouw database instance wijst

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // TODO: volledige INSERT query hier plaatsen, zie eerdere suggestie met 35 parameters.
    // Voor nu vervangen met een stub zodat de build niet faalt:
    await db.query(
      `INSERT INTO sollicitaties (
        voornaam, achternaam, geboortedatum, email, telefoon, adres, postcode, woonplaats,
        startdatum, einddatum, bijbaan, vakantie,
        beschikbaar_ma_1, beschikbaar_ma_2,
        beschikbaar_di_1, beschikbaar_di_2,
        beschikbaar_wo_1, beschikbaar_wo_2,
        beschikbaar_do_1, beschikbaar_do_2,
        beschikbaar_vr_1, beschikbaar_vr_2,
        beschikbaar_za_1, beschikbaar_za_2,
        beschikbaar_zo_1, beschikbaar_zo_2,
        shifts_per_week, voorkeur, opleiding, ervaring, rekenen, kassa, duits, extra
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12,
        $13, $14, $15, $16, $17, $18, $19, $20,
        $21, $22, $23, $24, $25, $26, $27, $28,
        $29, $30, $31, $32, $33, $34, $35
      )`,
      [
        body.voornaam, body.achternaam, body.geboortedatum, body.email, body.telefoon, body.adres,
        body.postcode, body.woonplaats, body.startdatum, body.einddatum, body.bijbaan, body.vakantie,
        body.beschikbaar_ma_1, body.beschikbaar_ma_2,
        body.beschikbaar_di_1, body.beschikbaar_di_2,
        body.beschikbaar_wo_1, body.beschikbaar_wo_2,
        body.beschikbaar_do_1, body.beschikbaar_do_2,
        body.beschikbaar_vr_1, body.beschikbaar_vr_2,
        body.beschikbaar_za_1, body.beschikbaar_za_2,
        body.beschikbaar_zo_1, body.beschikbaar_zo_2,
        body.shifts_per_week, body.voorkeur, body.opleiding,
        body.ervaring, body.rekenen, body.kassa, body.duits, body.extra
      ]
    ); // result verwijderd omdat het niet gebruikt wordt

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Fout bij POST /api/sollicitaties", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
