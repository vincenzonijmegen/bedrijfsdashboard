import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { ensureIndependentFreeRoomTransferStreams } from "@/lib/cashflow/berekenHoldingsMeerjaren";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const toNumberOrNull = (v: unknown) => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error("Ongeldig getal");
  return n;
};

async function getData() {
  await ensureIndependentFreeRoomTransferStreams();

  const [entiteiten, rekeningen, stromen, bedragen] = await Promise.all([
    db.query(`
      SELECT e.id, e.naam, e.type, e.actief,
             i.minimum_kasbuffer, i.prognosegroei_pct, i.loonkosten_groei_pct
      FROM cashflow_entiteiten e
      LEFT JOIN cashflow_instellingen i ON i.entiteit_id = e.id
      ORDER BY CASE e.type WHEN 'werkmaatschappij' THEN 1 ELSE 2 END, e.naam
    `),
    db.query(`
      SELECT r.id, r.entiteit_id, e.naam AS entiteit,
             r.naam, r.rekening_type, r.prognose_startsaldo,
             r.saldo_peildatum, r.actief
      FROM cashflow_rekeningen r
      JOIN cashflow_entiteiten e ON e.id = r.entiteit_id
      ORDER BY e.naam, r.naam
    `),
    db.query(`
      SELECT s.id, s.naam, s.categorie, s.van_entiteit_id, ve.naam AS van_entiteit,
             s.naar_entiteit_id, ne.naam AS naar_entiteit, s.tegenpartij_naam,
             s.gedrag, s.uitstelbaar, s.frequentie, s.startdatum, s.einddatum,
             s.actief, s.bron_stroom_id, bs.naam AS bron_stroom,
             s.berekeningswijze, s.fiscale_behandeling
      FROM cashflow_stromen s
      LEFT JOIN cashflow_entiteiten ve ON ve.id = s.van_entiteit_id
      LEFT JOIN cashflow_entiteiten ne ON ne.id = s.naar_entiteit_id
      LEFT JOIN cashflow_stromen bs ON bs.id = s.bron_stroom_id
      ORDER BY s.startdatum, s.naam
    `),
    db.query(`
      SELECT b.id, b.stroom_id, s.naam AS stroom,
             b.geldig_vanaf, b.geldig_tot, b.bedrag,
             b.percentage_van_bron, b.btw_percentage,
             b.btw_aftrekbaar_percentage, b.bedrag_is_inclusief_btw
      FROM cashflow_stroom_bedragen b
      JOIN cashflow_stromen s ON s.id = b.stroom_id
      ORDER BY s.naam, b.geldig_vanaf DESC
    `),
  ]);

  return {
    entiteiten: entiteiten.rows,
    rekeningen: rekeningen.rows,
    stromen: stromen.rows,
    bedragen: bedragen.rows,
  };
}

export async function GET() {
  try {
    return NextResponse.json({ success: true, data: await getData() });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const type = String(body?.type || "");

    if (type === "instelling") {
      const entiteitId = Number(body.entiteit_id);
      const minimum = toNumberOrNull(body.minimum_kasbuffer);
      const groei = toNumberOrNull(body.prognosegroei_pct);
      const loonkostenGroei = toNumberOrNull(body.loonkosten_groei_pct);
      if (!Number.isInteger(entiteitId)) throw new Error("Ongeldige entiteit");
      if (minimum !== null && minimum < 0) throw new Error("Kasbuffer mag niet negatief zijn");
      if (loonkostenGroei !== null && (loonkostenGroei < -50 || loonkostenGroei > 100)) throw new Error("Loonkostengroei moet tussen -50% en 100% liggen");

      await db.query(`
        INSERT INTO cashflow_instellingen (entiteit_id, minimum_kasbuffer, prognosegroei_pct, loonkosten_groei_pct)
        VALUES ($1,$2,$3,$4)
        ON CONFLICT (entiteit_id) DO UPDATE
        SET minimum_kasbuffer = EXCLUDED.minimum_kasbuffer,
            prognosegroei_pct = EXCLUDED.prognosegroei_pct,
            loonkosten_groei_pct = EXCLUDED.loonkosten_groei_pct,
            bijgewerkt_op = now()
      `, [entiteitId, minimum, groei, loonkostenGroei]);
    } else if (type === "rekening") {
      const id = Number(body.id);
      const saldo = toNumberOrNull(body.prognose_startsaldo);
      const peildatum = body.saldo_peildatum ? String(body.saldo_peildatum) : null;
      if (!Number.isInteger(id)) throw new Error("Ongeldige rekening");
      if ((saldo === null) !== (peildatum === null)) throw new Error("Startsaldo en peildatum moeten samen worden ingevuld");

      await db.query(`
        UPDATE cashflow_rekeningen
        SET prognose_startsaldo=$2, saldo_peildatum=$3, bijgewerkt_op=now()
        WHERE id=$1
      `, [id, saldo, peildatum]);
    } else if (type === "stroom") {
      const id = Number(body.id);
      if (!Number.isInteger(id)) throw new Error("Ongeldige geldstroom");
      const einddatum = body.einddatum ? String(body.einddatum) : null;
      const actief = Boolean(body.actief);
      const uitstelbaar = Boolean(body.uitstelbaar);
      await db.query(`
        UPDATE cashflow_stromen
        SET einddatum=$2, actief=$3, uitstelbaar=$4, bijgewerkt_op=now()
        WHERE id=$1
      `, [id, einddatum, actief, uitstelbaar]);
    } else {
      return NextResponse.json({ success: false, error: "Onbekend wijzigingstype" }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: await getData() });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    if (String(body?.type) !== "bedrag") {
      return NextResponse.json(
        { success: false, error: "Onbekend verwijdertype" },
        { status: 400 }
      );
    }

    const id = Number(body.id);
    if (!Number.isInteger(id)) throw new Error("Ongeldige tariefregel");

    const client = await db.getClient();
    try {
      await client.query("BEGIN");

      const target = await client.query(`
        SELECT id, stroom_id, geldig_vanaf, bedrag, percentage_van_bron
        FROM cashflow_stroom_bedragen
        WHERE id = $1
        FOR UPDATE
      `, [id]);

      if (!target.rowCount) throw new Error("Tariefregel niet gevonden");

      const row = target.rows[0];
      const stroomId = Number(row.stroom_id);
      const isFixedAmount = row.bedrag !== null && row.percentage_van_bron === null;

      if (!isFixedAmount) {
        throw new Error("Alleen vaste bedragstarieven kunnen via dit scherm worden verwijderd");
      }

      const remaining = await client.query(`
        SELECT COUNT(*)::int AS aantal
        FROM cashflow_stroom_bedragen
        WHERE stroom_id = $1
          AND id <> $2
          AND bedrag IS NOT NULL
          AND percentage_van_bron IS NULL
      `, [stroomId, id]);

      if (Number(remaining.rows[0]?.aantal || 0) < 1) {
        throw new Error(
          "De laatste tariefregel van een geldstroom kan niet worden verwijderd. Voeg eerst een vervangend tarief toe."
        );
      }

      const previous = await client.query(`
        SELECT id
        FROM cashflow_stroom_bedragen
        WHERE stroom_id = $1
          AND geldig_vanaf < $2::date
          AND bedrag IS NOT NULL
          AND percentage_van_bron IS NULL
        ORDER BY geldig_vanaf DESC
        LIMIT 1
        FOR UPDATE
      `, [stroomId, row.geldig_vanaf]);

      const next = await client.query(`
        SELECT id, geldig_vanaf
        FROM cashflow_stroom_bedragen
        WHERE stroom_id = $1
          AND geldig_vanaf > $2::date
          AND bedrag IS NOT NULL
          AND percentage_van_bron IS NULL
        ORDER BY geldig_vanaf
        LIMIT 1
        FOR UPDATE
      `, [stroomId, row.geldig_vanaf]);

      await client.query(
        "DELETE FROM cashflow_stroom_bedragen WHERE id = $1",
        [id]
      );

      if (previous.rowCount) {
        const previousId = Number(previous.rows[0].id);
        if (next.rowCount) {
          await client.query(`
            UPDATE cashflow_stroom_bedragen
            SET geldig_tot = ($2::date - INTERVAL '1 day')::date,
                bijgewerkt_op = now()
            WHERE id = $1
          `, [previousId, next.rows[0].geldig_vanaf]);
        } else {
          await client.query(`
            UPDATE cashflow_stroom_bedragen
            SET geldig_tot = NULL,
                bijgewerkt_op = now()
            WHERE id = $1
          `, [previousId]);
        }
      }

      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    return NextResponse.json({ success: true, data: await getData() });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 400 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (String(body?.type) !== "bedrag") {
      return NextResponse.json({ success: false, error: "Onbekend invoertype" }, { status: 400 });
    }

    const stroomId = Number(body.stroom_id);
    const geldigVanaf = String(body.geldig_vanaf || "");
    const geldigTot = body.geldig_tot ? String(body.geldig_tot) : null;
    const bedrag = toNumberOrNull(body.bedrag);
    const percentage = toNumberOrNull(body.percentage_van_bron);
    const btw = toNumberOrNull(body.btw_percentage) ?? 0;
    const aftrek = toNumberOrNull(body.btw_aftrekbaar_percentage) ?? 100;

    if (!Number.isInteger(stroomId) || !geldigVanaf) throw new Error("Stroom en ingangsdatum zijn verplicht");
    if ((bedrag === null) === (percentage === null)) throw new Error("Vul óf een bedrag óf een percentage in");
    if (bedrag !== null && bedrag < 0) throw new Error("Bedrag mag niet negatief zijn");
    if (percentage !== null && (percentage < 0 || percentage > 100)) throw new Error("Percentage moet tussen 0 en 100 liggen");

    const client = await db.getClient();
    try {
      await client.query("BEGIN");

      const nextTariff = await client.query(`
        SELECT
          to_char(geldig_vanaf, 'YYYY-MM-DD') AS geldig_vanaf,
          to_char(
            (geldig_vanaf - INTERVAL '1 day')::date,
            'YYYY-MM-DD'
          ) AS max_geldig_tot
        FROM cashflow_stroom_bedragen
        WHERE stroom_id = $1
          AND geldig_vanaf > $2::date
        ORDER BY geldig_vanaf
        LIMIT 1
      `, [stroomId, geldigVanaf]);

      const nextValidFrom =
        nextTariff.rows[0]?.geldig_vanaf
          ? String(nextTariff.rows[0].geldig_vanaf)
          : null;

      let effectiveValidTo = geldigTot;

      if (nextValidFrom) {
        const maxValidTo = String(nextTariff.rows[0].max_geldig_tot);

        if (effectiveValidTo && effectiveValidTo > maxValidTo) {
          throw new Error(
            `Einddatum mag niet na ${maxValidTo} liggen; vanaf ${nextValidFrom} bestaat al een volgend tarief`
          );
        }

        if (!effectiveValidTo) effectiveValidTo = maxValidTo;
      }

      if (effectiveValidTo && effectiveValidTo < geldigVanaf) {
        throw new Error("Einddatum mag niet vóór de ingangsdatum liggen");
      }

      await client.query(`
        UPDATE cashflow_stroom_bedragen
        SET geldig_tot = ($2::date - INTERVAL '1 day')::date,
            bijgewerkt_op = now()
        WHERE stroom_id=$1
          AND geldig_vanaf < $2::date
          AND (geldig_tot IS NULL OR geldig_tot >= $2::date)
      `, [stroomId, geldigVanaf]);

      await client.query(`
        INSERT INTO cashflow_stroom_bedragen (
          stroom_id, geldig_vanaf, geldig_tot, bedrag, percentage_van_bron,
          btw_percentage, btw_aftrekbaar_percentage, bedrag_is_inclusief_btw
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        ON CONFLICT (stroom_id, geldig_vanaf) DO UPDATE
        SET geldig_tot=EXCLUDED.geldig_tot,
            bedrag=EXCLUDED.bedrag,
            percentage_van_bron=EXCLUDED.percentage_van_bron,
            btw_percentage=EXCLUDED.btw_percentage,
            btw_aftrekbaar_percentage=EXCLUDED.btw_aftrekbaar_percentage,
            bedrag_is_inclusief_btw=EXCLUDED.bedrag_is_inclusief_btw,
            bijgewerkt_op=now()
      `, [stroomId, geldigVanaf, effectiveValidTo, bedrag, percentage, btw, aftrek, body.bedrag_is_inclusief_btw !== false]);

      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }

    return NextResponse.json({ success: true, data: await getData() });
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) }, { status: 400 });
  }
}
