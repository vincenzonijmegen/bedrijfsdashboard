import { NextRequest, NextResponse } from "next/server";
import { sendSollicitatieMail } from "@/lib/mail";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clean(v: unknown) {
  return String(v ?? "").trim();
}

function emptyToNull(value: string) {
  return value.trim() ? value.trim() : null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const payload = {
      voornaam: clean(body.voornaam),
      achternaam: clean(body.achternaam),
      adres: clean(body.adres),
      huisnummer: clean(body.huisnummer),
      postcode: clean(body.postcode),
      woonplaats: clean(body.woonplaats),
      geboortedatum: clean(body.geboortedatum),
      geslacht: clean(body.geslacht),
      email: clean(body.email),
      tel: clean(body.tel),
      beschikbaar_vanaf: clean(body.beschikbaar_vanaf),
      beschikbaar_tot: clean(body.beschikbaar_tot),
      bijbaan: clean(body.bijbaan),
      voorkeur_functie: clean(body.voorkeur_functie),
      shifts_per_week: clean(body.shifts_per_week),
      vakantie: clean(body.vakantie),
      momenten: Array.isArray(body.beschikbaar_momenten)
        ? body.beschikbaar_momenten.map((m: unknown) => clean(m)).filter(Boolean)
        : [],
      motivatie: clean(body.motivatie),
    };

    if (
      !payload.voornaam ||
      !payload.achternaam ||
      !payload.email ||
      !payload.tel
    ) {
      return NextResponse.json(
        { success: false, error: "Ontbrekende gegevens" },
        { status: 400 }
      );
    }

    await db.query(
      `
      INSERT INTO sollicitaties (
        voornaam,
        achternaam,
        adres,
        huisnummer,
        postcode,
        woonplaats,
        geboortedatum,
        geslacht,
        email,
        telefoon,
        beschikbaar_vanaf,
        beschikbaar_tot,
        bijbaan,
        voorkeur_functie,
        shifts_per_week,
        vakantie,
        beschikbaar_momenten,
        motivatie
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,$17,$18
      )
      `,
      [
        payload.voornaam,
        payload.achternaam,
        emptyToNull(payload.adres),
        emptyToNull(payload.huisnummer),
        emptyToNull(payload.postcode),
        emptyToNull(payload.woonplaats),
        emptyToNull(payload.geboortedatum),
        emptyToNull(payload.geslacht),
        payload.email,
        payload.tel,
        emptyToNull(payload.beschikbaar_vanaf),
        emptyToNull(payload.beschikbaar_tot),
        emptyToNull(payload.bijbaan),
        emptyToNull(payload.voorkeur_functie),
        emptyToNull(payload.shifts_per_week),
        emptyToNull(payload.vakantie),
        payload.momenten,
        emptyToNull(payload.motivatie),
      ]
    );

    await sendSollicitatieMail(payload);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Sollicitatieformulier fout:", err);

    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      },
      { status: 500 }
    );
  }
}