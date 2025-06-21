// app/api/sollicitaties/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db"; // Zorg dat dit naar jouw database instance wijst

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const dagen = body?.dagen || [];
    const isBeschikbaar = (dag: string, shift: number) => dagen.includes(`${dag} shift ${shift}`);

    const parseDate = (d: string) => d?.split("-").reverse().join("-");

    // TODO: volledige INSERT query hier plaatsen, zie eerdere suggestie met 35 parameters.
    // Voor nu vervangen met een stub zodat de build niet faalt:
    await db.query(
      `INSERT INTO sollicitaties (
        geboortedatum, startdatum, einddatum,
        voornaam, achternaam, rekenen,
        email, telefoon, adres, postcode, woonplaats,
        kassa, duits, bijbaan, vakantie, extra,
        voorkeur, opleiding, ervaring,
        beschikbaar_ma_1, beschikbaar_ma_2,
        beschikbaar_di_1, beschikbaar_di_2,
        beschikbaar_wo_1, beschikbaar_wo_2,
        beschikbaar_do_1, beschikbaar_do_2,
        beschikbaar_vr_1, beschikbaar_vr_2,
        beschikbaar_za_1, beschikbaar_za_2,
        beschikbaar_zo_1, beschikbaar_zo_2,
        shifts_per_week
      ) VALUES (
        $1, $2, $3,
        $4, $5, $6,
        $7, $8, $9, $10, $11,
        $12, $13, $14, $15, $16,
        $17, $18, $19,
        $20, $21,
        $22, $23,
        $24, $25,
        $26, $27,
        $28, $29,
        $30, $31,
        $32, $33,
        $34
      )`,
      [
        parseDate(body.geboortedatum), parseDate(body.startdatum), parseDate(body.einddatum),
        body.voornaam, body.achternaam, body.rekenen,
        body.email, body.telefoon, body.adres, body.postcode, body.woonplaats,
        body.kassa, body.duits, body.bijbaan, body.vakantie, body.extra,
        body.voorkeur, body.opleiding, body.ervaring,
        isBeschikbaar('maandag', 1), isBeschikbaar('maandag', 2),
        isBeschikbaar('dinsdag', 1), isBeschikbaar('dinsdag', 2),
        isBeschikbaar('woensdag', 1), isBeschikbaar('woensdag', 2),
        isBeschikbaar('donderdag', 1), isBeschikbaar('donderdag', 2),
        isBeschikbaar('vrijdag', 1), isBeschikbaar('vrijdag', 2),
        isBeschikbaar('zaterdag', 1), isBeschikbaar('zaterdag', 2),
        isBeschikbaar('zondag', 1), isBeschikbaar('zondag', 2),
        body.shifts_per_week
      ]
    ); // result verwijderd omdat het niet gebruikt wordt

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Fout bij POST /api/sollicitaties", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
