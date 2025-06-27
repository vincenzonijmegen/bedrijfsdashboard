export const dynamic = "force-dynamic";

import { db } from "@/lib/db";
import { UUID } from "crypto";
import { NextResponse } from "next/server";
import { Resend } from "resend";



type Fout = {
  vraag: string;
  gegeven: string;
  gekozenTekst: string;
};

export async function POST(req: Request) {
  const resend = new Resend(process.env.RESEND_API_KEY ?? "");
  try {
    const body = await req.json();
    const {
      naam,
      email,
      score,
      juist,
      totaal,
      instructie_id,
      titel,
      tijdstip,
      functie,
      fouten,
    }: {
      naam: string;
      email: string;
      score: number;
      juist: number;
      totaal: number;
      instructie_id: UUID;
      titel: string;
      tijdstip?: string;
      functie: string;
      fouten?: Fout[];
    } = body;

await db.query(
  `INSERT INTO toetsresultaten (naam, email, score, juist, totaal, instructie_id, tijdstip, functie)
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
   ON CONFLICT (email, instructie_id)
   DO UPDATE SET
     score = EXCLUDED.score,
     juist = EXCLUDED.juist,
     totaal = EXCLUDED.totaal,
     tijdstip = EXCLUDED.tijdstip,
     functie = EXCLUDED.functie`,
      [
        naam,
        email,
        score,
        juist,
        totaal,
        instructie_id,
        tijdstip || new Date(),
        functie
      ]
    );

    // ⏱️ Haal leestijd op
    const duurRes = await db.query(
      `SELECT gelezen_duur_seconden FROM gelezen_instructies
       WHERE email = $1 AND instructie_id = $2`,
      [email, instructie_id]
    );
    const duur_seconden = typeof duurRes.rows[0]?.gelezen_duur_seconden === "number"
  ? duurRes.rows[0].gelezen_duur_seconden
  : "-";

    const foutenLijst =
      fouten && fouten.length > 0
        ? (fouten as Fout[])
            .map(
              (f, i) =>
                `${i + 1}. Vraag: ${f.vraag}
   Antwoord (${f.gegeven}): ${f.gekozenTekst}
`
            )
            .join("\n")
        : "✅ Alles correct beantwoord.";

    const mailContent = `
Toetsresultaat van ${naam} (${email})

📘 Titel: ${titel}
🎯 Score: ${score}% (${juist} van ${totaal} juist)
🕒 Leestijd: ${duur_seconden} seconden

Fout beantwoorde vragen:
${foutenLijst}
    `;

    await resend.emails.send({
      from: "IJssalon Vincenzo <noreply@ijssalonvincenzo.nl>",
      to: "herman@ijssalonvincenzo.nl",
      subject: `Nieuw toetsresultaat: ${titel} – ${naam}`,
      text: mailContent,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Fout bij opslaan of verzenden:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET() {
  try {
    const result = await db.query(
      `SELECT t.naam, t.email, t.score, t.juist, t.totaal, i.titel, t.tijdstip, t.functie,
              g.gelezen_duur_seconden AS duur_seconden
       FROM toetsresultaten t
       LEFT JOIN instructies i ON t.instructie_id = i.id
       LEFT JOIN gelezen_instructies g
         ON g.email = t.email AND g.instructie_id = t.instructie_id
       ORDER BY t.tijdstip DESC`
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("❌ Fout bij ophalen resultaten:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const email = url.searchParams.get("email");
    const titel = url.searchParams.get("titel");

    if (!email || !titel) {
      return NextResponse.json({ error: "email en titel zijn verplicht" }, { status: 400 });
    }

    await db.query(
      `DELETE FROM toetsresultaten WHERE email = $1 AND titel = $2`,
      [email, titel]
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("❌ Fout bij verwijderen resultaat:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
