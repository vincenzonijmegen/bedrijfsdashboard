import { db } from "@/lib/db";
import { UUID } from "crypto";
import { NextResponse } from "next/server";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

type Fout = {
  vraag: string;
  gegeven: string;
  gekozenTekst: string;
};


export async function POST(req: Request) {
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
   VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
  [naam, email, score, juist, totaal, instructie_id, tijdstip || new Date(), functie]
);

    const foutenLijst =
  fouten && fouten.length > 0
    ? (fouten as Fout[])
        .map(
  (f, i) =>
    `${i + 1}. Vraag: ${f.vraag}\n   Antwoord (${f.gegeven}): ${f.gekozenTekst}\n`
  )
  .join("\n")
    : "✅ Alles correct beantwoord.";

    const mailContent = `
Toetsresultaat van ${naam} (${email})

📘 Titel: ${titel}
🎯 Score: ${score}% (${juist} van ${totaal} juist)

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
      `SELECT naam, email, score, juist, totaal, titel, tijdstip, functie
       FROM toetsresultaten
       ORDER BY tijdstip DESC`
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
