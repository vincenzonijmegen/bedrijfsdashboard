// src/app/api/admin/mail/herinnering/route.ts

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { db } from "@/lib/db";

const resend = new Resend(process.env.RESEND_API_KEY || "");

export async function POST(req: NextRequest) {
  const { emails, onderwerp, tekst, cc } = await req.json();

  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: "Geen e-mails opgegeven" }, { status: 400 });
  }

  try {
    const naamResult = await db.query(
      `SELECT email, naam FROM medewerkers WHERE email = ANY($1)`,
      [emails]
    );

    const naamMap = Object.fromEntries(
      naamResult.rows.map((r: { email: string; naam: string }) => [r.email, r.naam])
    );

    await Promise.all(
      emails.map((to) => {
        const volledigeNaam = naamMap[to] || "medewerker";
        const voornaam = volledigeNaam.split(" ")[0];

        const gepersonaliseerd = tekst
          .replace(/\{email\}/gi, to)
          .replace(/\{voornaam\}/gi, voornaam.charAt(0).toUpperCase() + voornaam.slice(1));

        return resend.emails.send({
          from: "Team Vincenzo <noreply@ijssalonvincenzo.nl>",
          to,
          cc,
          subject: onderwerp,
          text: gepersonaliseerd,
        });
      })
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Fout bij verzenden herinnering:", err);
    return NextResponse.json({ error: "Verzenden mislukt" }, { status: 500 });
  }
}
