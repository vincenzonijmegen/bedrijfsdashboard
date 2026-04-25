import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const voornaam = String(body?.voornaam || "").trim();
    const achternaam = String(body?.achternaam || "").trim();
    const adres = String(body?.adres || "").trim();
    const huisnummer = String(body?.huisnummer || "").trim();
    const postcode = String(body?.postcode || "").trim();
    const woonplaats = String(body?.woonplaats || "").trim();
    const geboortedatum = body?.geboortedatum || null;
    const geslacht = String(body?.geslacht || "").trim();
    const email = String(body?.email || "").trim();
    const telefoon = String(body?.tel || "").trim();

    const beschikbaar_vanaf = body?.beschikbaar_vanaf || null;
    const beschikbaar_tot = body?.beschikbaar_tot || null;
    const bijbaan = String(body?.bijbaan || "").trim();
    const voorkeur_functie = String(body?.voorkeur_functie || "").trim();
    const shifts_per_week = String(body?.shifts_per_week || "").trim();
    const vakantie = String(body?.vakantie || "").trim();
    const motivatie = String(body?.motivatie || "").trim();

    const beschikbaar_momenten = Array.isArray(body?.beschikbaar_momenten)
      ? body.beschikbaar_momenten
      : [];

    if (!voornaam || !achternaam || !email || !telefoon) {
      return NextResponse.json(
        { success: false, error: "Verplichte velden ontbreken" },
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
        voornaam,
        achternaam,
        adres || null,
        huisnummer || null,
        postcode || null,
        woonplaats || null,
        geboortedatum || null,
        geslacht || null,
        email,
        telefoon,
        beschikbaar_vanaf || null,
        beschikbaar_tot || null,
        bijbaan || null,
        voorkeur_functie || null,
        shifts_per_week || null,
        vakantie || null,
        beschikbaar_momenten,
        motivatie || null,
      ]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Fout bij opslaan sollicitatie:", error);

    return NextResponse.json(
      { success: false, error: "Serverfout" },
      { status: 500 }
    );
  }
}