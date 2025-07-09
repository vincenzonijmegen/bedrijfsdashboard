// src/app/api/admin/mail/herinnering/route.ts

import { NextRequest, NextResponse } from "next/server";
import { resend } from "@/lib/resend"; // Zorg dat deze lib goed geconfigureerd is

export async function POST(req: NextRequest) {
  const { emails, onderwerp, tekst, cc } = await req.json();

  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: "Geen e-mails opgegeven" }, { status: 400 });
  }

  try {
    await Promise.all(
      emails.map((to) =>
        resend.emails.send({
          from: "Team Vincenzo <noreply@ijssalonvincenzo.nl>",
          to,
          cc,
          subject: onderwerp,
          text: tekst,
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Fout bij verzenden herinnering:", err);
    return NextResponse.json({ error: "Verzenden mislukt" }, { status: 500 });
  }
}
