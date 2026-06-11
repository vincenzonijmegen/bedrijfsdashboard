import crypto from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sendBeschikbaarheidsOpgaveMail } from "@/lib/beschikbaarheidsMail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function maakLink(token: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://werkinstructies-app.vercel.app";
  return `${baseUrl.replace(/\/$/, "")}/beschikbaarheid/${token}`;
}

export async function GET(req: Request) {
  try {
    const auth = req.headers.get("authorization");
    if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Niet toegestaan" }, { status: 401 });
    }

    const result = await db.query(`
      SELECT
        d.id,
        d.medewerker_email,
        COALESCE(m.naam, d.medewerker_email) AS naam,
        r.naam AS ronde_naam,
        r.start_datum,
        r.eind_datum,
        r.deadline,
        r.toelichting
      FROM beschikbaarheids_deelnames d
      JOIN beschikbaarheids_rondes r ON r.id = d.ronde_id
      LEFT JOIN medewerkers m ON m.email = d.medewerker_email
      WHERE d.status = 'uitgesteld'
        AND d.herinner_mij_op <= CURRENT_DATE
        AND d.ingevuld_op IS NULL
        AND r.status = 'actief'
      ORDER BY d.herinner_mij_op ASC
    `);

    const verzonden: string[] = [];

    for (const row of result.rows) {
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = hashToken(token);

      await db.query(
        `UPDATE beschikbaarheids_deelnames
         SET token_hash = $1, status = 'open', laatste_herinnering_op = NOW(), herinner_mij_op = NULL
         WHERE id = $2`,
        [tokenHash, row.id]
      );

      await sendBeschikbaarheidsOpgaveMail({
        naar: row.medewerker_email,
        naam: row.naam,
        rondeNaam: row.ronde_naam,
        startDatum: row.start_datum,
        eindDatum: row.eind_datum,
        deadline: row.deadline,
        toelichting: row.toelichting,
        link: maakLink(token),
        herinnering: true,
      });

      verzonden.push(row.medewerker_email);
    }

    return NextResponse.json({ success: true, aantal: verzonden.length, verzonden });
  } catch (error) {
    console.error("Fout bij beschikbaarheidsherinneringen:", error);
    return NextResponse.json({ error: "Herinneringen mislukt" }, { status: 500 });
  }
}
