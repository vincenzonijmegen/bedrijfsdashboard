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

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const rondeId = Number(params.id);

    const result = await db.query(
      `SELECT
        d.id,
        d.ronde_id,
        d.medewerker_email,
        COALESCE(m.naam, d.medewerker_email) AS naam,
        d.verzonden_op,
        d.laatste_herinnering_op,
        d.status,
        d.herinner_mij_op,
        d.ingevuld_op,
        o.ma_shift_1, o.ma_shift_2,
        o.di_shift_1, o.di_shift_2,
        o.wo_shift_1, o.wo_shift_2,
        o.do_shift_1, o.do_shift_2,
        o.vr_shift_1, o.vr_shift_2,
        o.za_shift_1, o.za_shift_2,
        o.zo_shift_1, o.zo_shift_2,
        o.max_diensten_per_week,
        o.toelichting
      FROM beschikbaarheids_deelnames d
      LEFT JOIN medewerkers m ON m.email = d.medewerker_email
      LEFT JOIN beschikbaarheids_opgaven o
        ON o.ronde_id = d.ronde_id AND o.medewerker_email = d.medewerker_email
      WHERE d.ronde_id = $1
      ORDER BY COALESCE(m.naam, d.medewerker_email)`,
      [rondeId]
    );

    return NextResponse.json(result.rows);
  } catch (error) {
    console.error("Fout bij laden deelnames:", error);
    return NextResponse.json({ error: "Laden mislukt" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const rondeId = Number(params.id);
    const body = await req.json();
    const emails: string[] = body.emails || [];
    const alleenHerinneren: boolean = body.alleenHerinneren === true;

    const rondeRes = await db.query(`SELECT * FROM beschikbaarheids_rondes WHERE id = $1`, [rondeId]);
    if (rondeRes.rowCount === 0) {
      return NextResponse.json({ error: "Uitvraag niet gevonden" }, { status: 404 });
    }
    const ronde = rondeRes.rows[0];

    const verzonden: string[] = [];
    const overgeslagen: string[] = [];

    for (const email of emails) {
      const medewerkerRes = await db.query(`SELECT naam, email FROM medewerkers WHERE email = $1`, [email]);
      const medewerker = medewerkerRes.rows[0];
      if (!medewerker) {
        overgeslagen.push(email);
        continue;
      }

      let token = crypto.randomBytes(32).toString("hex");
      let tokenHash = hashToken(token);

      const bestaande = await db.query(
        `SELECT id, token_hash, status FROM beschikbaarheids_deelnames WHERE ronde_id = $1 AND medewerker_email = $2`,
        [rondeId, email]
      );

      if (bestaande.rowCount > 0) {
        if (alleenHerinneren && bestaande.rows[0].status === "ingevuld") {
          overgeslagen.push(email);
          continue;
        }
        await db.query(
          `UPDATE beschikbaarheids_deelnames
           SET token_hash = $1, verzonden_op = COALESCE(verzonden_op, NOW()), laatste_herinnering_op = NOW(),
               status = CASE WHEN status = 'ingevuld' THEN status ELSE 'open' END,
               herinner_mij_op = CASE WHEN status = 'ingevuld' THEN herinner_mij_op ELSE NULL END
           WHERE ronde_id = $2 AND medewerker_email = $3`,
          [tokenHash, rondeId, email]
        );
      } else {
        await db.query(
          `INSERT INTO beschikbaarheids_deelnames
            (ronde_id, medewerker_email, token_hash, verzonden_op, status)
           VALUES ($1, $2, $3, NOW(), 'open')`,
          [rondeId, email, tokenHash]
        );
      }

      await sendBeschikbaarheidsOpgaveMail({
        naar: medewerker.email,
        naam: medewerker.naam || medewerker.email,
        rondeNaam: ronde.naam,
        startDatum: ronde.start_datum,
        eindDatum: ronde.eind_datum,
        deadline: ronde.deadline,
        toelichting: ronde.toelichting,
        link: maakLink(token),
        herinnering: bestaande.rowCount > 0,
      });

      verzonden.push(email);
    }

    return NextResponse.json({ success: true, verzonden, overgeslagen });
  } catch (error) {
    console.error("Fout bij verzenden beschikbaarheidsmail:", error);
    return NextResponse.json({ error: "Verzenden mislukt" }, { status: 500 });
  }
}
