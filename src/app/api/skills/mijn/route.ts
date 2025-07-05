// /api/skills/mijn

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const userId = req.headers.get("x-user-id");
  if (!userId) {
    return NextResponse.json({ skills: [], warning: "Geen gebruiker meegegeven" }, { status: 200 });
  }

  try {
    const skills = await db.skill_status.findMany({
      where: { medewerker_id: parseInt(userId) },
      include: {
        skill: {
          select: {
            naam: true,
            categorie: {
              select: { naam: true },
            },
          },
        },
      },
    });

    return NextResponse.json({ skills });
  } catch (err) {
    return NextResponse.json({ skills: [], warning: "Databasefout", details: String(err) }, { status: 200 });
  }
}
