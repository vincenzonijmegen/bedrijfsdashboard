import crypto from "crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const dagen = ["ma", "di", "wo", "do", "vr", "za", "zo"] as const;

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function uitersteHerinnerDatum(startDatum: string) {
  const d = new Date(startDatum);
  d.setDate(d.getDate() - 14);
  return d.toISOString().slice(0, 10);
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const tokenHash = hashToken(token);

    const result = await db.query(
      `SELECT
        d.id AS deelname_id,
        d.medewerker_email,
        d.status,
        d.herinner_mij_op,
        d.ingevuld_op,
        COALESCE(m.naam, d.medewerker_email) AS naam,
        r.id AS ronde_id,
        r.naam AS ronde_naam,
        r.start_datum,
        r.eind_datum,
        r.deadline,
        r.toelichting,
        r.status AS ronde_status,
        o.ma_shift_1, o.ma_shift_2,
        o.di_shift_1, o.di_shift_2,
        o.wo_shift_1, o.wo_shift_2,
        o.do_shift_1, o.do_shift_2,
        o.vr_shift_1, o.vr_shift_2,
        o.za_shift_1, o.za_shift_2,
        o.zo_shift_1, o.zo_shift_2,
        o.max_diensten_per_week,
        o.toelichting AS opgave_toelichting
      FROM beschikbaarheids_deelnames d
      JOIN beschikbaarheids_rondes r ON r.id = d.ronde_id
      LEFT JOIN medewerkers m ON m.email = d.medewerker_email
      LEFT JOIN beschikbaarheids_opgaven o
        ON o.ronde_id = d.ronde_id AND o.medewerker_email = d.medewerker_email
      WHERE d.token_hash = $1
      LIMIT 1`,
      [tokenHash]
    );

    if (result.rowCount === 0) {
      return NextResponse.json({ error: "Link niet gevonden" }, { status: 404 });
    }

    const row = result.rows[0];
    return NextResponse.json({
      ...row,
      uiterste_herinnerdatum: uitersteHerinnerDatum(row.start_datum),
    });
  } catch (error) {
    console.error("Fout bij laden token:", error);
    return NextResponse.json({ error: "Laden mislukt" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  context: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await context.params;
    const tokenHash = hashToken(token);
    const body = await req.json();

    const deelnameRes = await db.query(
      `SELECT d.*, r.start_datum, r.status AS ronde_status
       FROM beschikbaarheids_deelnames d
       JOIN beschikbaarheids_rondes r ON r.id = d.ronde_id
       WHERE d.token_hash = $1
       LIMIT 1`,
      [tokenHash]
    );

    if (deelnameRes.rowCount === 0) {
      return NextResponse.json({ error: "Link niet gevonden" }, { status: 404 });
    }

    const deelname = deelnameRes.rows[0];
    if (deelname.ronde_status === "gesloten") {
      return NextResponse.json({ error: "Deze uitvraag is gesloten" }, { status: 400 });
    }

    if (body.actie === "uitstellen") {
      const herinnerMijOp = body.herinner_mij_op;
      if (!herinnerMijOp) {
        return NextResponse.json({ error: "Kies een herinnerdatum" }, { status: 400 });
      }

      const uiterste = uitersteHerinnerDatum(deelname.start_datum);
      const vandaag = new Date().toISOString().slice(0, 10);

      if (herinnerMijOp < vandaag) {
        return NextResponse.json({ error: "De herinnerdatum mag niet in het verleden liggen" }, { status: 400 });
      }

      if (herinnerMijOp > uiterste) {
        return NextResponse.json(
          { error: `Kies een datum uiterlijk ${new Date(uiterste).toLocaleDateString("nl-NL")}` },
          { status: 400 }
        );
      }

      await db.query(
        `UPDATE beschikbaarheids_deelnames
         SET status = 'uitgesteld', herinner_mij_op = $1
         WHERE id = $2`,
        [herinnerMijOp, deelname.id]
      );

      return NextResponse.json({ success: true, status: "uitgesteld" });
    }

    const values: Record<string, boolean> = {};
    for (const dag of dagen) {
      values[`${dag}_shift_1`] = Boolean(body[`${dag}_shift_1`]);
      values[`${dag}_shift_2`] = Boolean(body[`${dag}_shift_2`]);
    }

    const maxDiensten = body.max_diensten_per_week ? Number(body.max_diensten_per_week) : null;

    await db.query(
      `INSERT INTO beschikbaarheids_opgaven (
        ronde_id, medewerker_email,
        ma_shift_1, ma_shift_2, di_shift_1, di_shift_2, wo_shift_1, wo_shift_2,
        do_shift_1, do_shift_2, vr_shift_1, vr_shift_2, za_shift_1, za_shift_2,
        zo_shift_1, zo_shift_2, max_diensten_per_week, toelichting, ingediend_op
      ) VALUES (
        $1, $2,
        $3, $4, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, NOW()
      )
      ON CONFLICT (ronde_id, medewerker_email) DO UPDATE SET
        ma_shift_1 = EXCLUDED.ma_shift_1,
        ma_shift_2 = EXCLUDED.ma_shift_2,
        di_shift_1 = EXCLUDED.di_shift_1,
        di_shift_2 = EXCLUDED.di_shift_2,
        wo_shift_1 = EXCLUDED.wo_shift_1,
        wo_shift_2 = EXCLUDED.wo_shift_2,
        do_shift_1 = EXCLUDED.do_shift_1,
        do_shift_2 = EXCLUDED.do_shift_2,
        vr_shift_1 = EXCLUDED.vr_shift_1,
        vr_shift_2 = EXCLUDED.vr_shift_2,
        za_shift_1 = EXCLUDED.za_shift_1,
        za_shift_2 = EXCLUDED.za_shift_2,
        zo_shift_1 = EXCLUDED.zo_shift_1,
        zo_shift_2 = EXCLUDED.zo_shift_2,
        max_diensten_per_week = EXCLUDED.max_diensten_per_week,
        toelichting = EXCLUDED.toelichting,
        ingediend_op = NOW()`,
      [
        deelname.ronde_id,
        deelname.medewerker_email,
        values.ma_shift_1,
        values.ma_shift_2,
        values.di_shift_1,
        values.di_shift_2,
        values.wo_shift_1,
        values.wo_shift_2,
        values.do_shift_1,
        values.do_shift_2,
        values.vr_shift_1,
        values.vr_shift_2,
        values.za_shift_1,
        values.za_shift_2,
        values.zo_shift_1,
        values.zo_shift_2,
        maxDiensten,
        body.toelichting || null,
      ]
    );

    await db.query(
      `UPDATE beschikbaarheids_deelnames
       SET status = 'ingevuld', ingevuld_op = NOW(), herinner_mij_op = NULL
       WHERE id = $1`,
      [deelname.id]
    );

    return NextResponse.json({ success: true, status: "ingevuld" });
  } catch (error) {
    console.error("Fout bij opslaan beschikbaarheid:", error);
    return NextResponse.json({ error: "Opslaan mislukt" }, { status: 500 });
  }
}
