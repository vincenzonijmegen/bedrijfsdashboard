import { NextRequest, NextResponse } from "next/server";
import { sendSollicitatieMail } from "@/lib/mail";

function clean(v: unknown) {
  return String(v ?? "").trim();
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

    if (!payload.voornaam || !payload.achternaam || !payload.email || !payload.tel) {
      return NextResponse.json({ error: "Ontbrekende gegevens" }, { status: 400 });
    }

    await sendSollicitatieMail(payload);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Sollicitatieformulier fout:", err);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}