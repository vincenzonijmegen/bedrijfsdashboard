// /src/app/api/skills/mijn/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const email = req.headers.get("x-user-email");
  if (!email) {
    return NextResponse.json({ skills: [], warning: "Geen e-mail meegegeven" }, { status: 400 });
  }

  try {
    // Zoek medewerker_id op basis van e-mailadres
    const medewerker = await db.medewerkers.findUnique({
      where: { email },
    });

    if (!medewerker) {
      return NextResponse.json({ skills: [], warning: "Medewerker niet gevonden" }, { status: 404 });
    }

    // Haal gekoppelde skills op via skill_status
    const result = await db.skill_status.findMany({
      where: { medewerker_id: medewerker.id },
      include: {
        skill: {
          include: { categorie: true },
        },
      },
    });

    // Vorm response
    const skills = result.map((s) => ({
      skill_id: s.skill_id,
      status: s.status,
      skill_naam: s.skill?.naam || "-",
      categorie: s.skill?.categorie?.naam || "-",
    }));

    return NextResponse.json({ skills });
  } catch (err) {
    return NextResponse.json({ skills: [], warning: "Databasefout", details: String(err) }, { status: 200 });
  }
}
