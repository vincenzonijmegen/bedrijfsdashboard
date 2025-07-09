// src/app/api/admin/mail/herinnering/route.ts

import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY || ""); // Zorg dat deze lib goed geconfigureerd is

export async function POST(req: NextRequest) {
  const { emails, onderwerp, tekst, cc } = await req.json();

  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: "Geen e-mails opgegeven" }, { status: 400 });
  }

  try {
    await Promise.all(
      emails.map((to) => {
        const voornaam = to.split("@")[0].split(".")[0].split("_")[0].split("-")[0];
        const gepersonaliseerd = tekst
          .replace(/\{email\}/gi, to)
          .replace(/\{voornaam\}/gi, voornaam.charAt(0).toUpperCase() + voornaam.slice(1));
        return resend.emails.send($1);
      })
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Fout bij verzenden herinnering:", err);
    return NextResponse.json({ error: "Verzenden mislukt" }, { status: 500 });
  }
}
