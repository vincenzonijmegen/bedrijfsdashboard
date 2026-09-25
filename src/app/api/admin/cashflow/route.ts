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
      const gedrag =
        body.gedrag === undefined || body.gedrag === null || body.gedrag === ""
          ? null
          : String(body.gedrag);

      if (gedrag !== null && gedrag !== "vast" && gedrag !== "planbaar") {
        throw new Error("Gedrag moet 'vast' of 'planbaar' zijn");
      }
      if (uitstelbaar && gedrag !== null && gedrag !== "planbaar") {
        throw new Error("Een uitstelbare geldstroom moet planbaar zijn");
      }

      await db.query(`
        UPDATE cashflow_stromen
        SET einddatum=$2,
            actief=$3,
            uitstelbaar=$4,
            gedrag=COALESCE($5, gedrag),
            bijgewerkt_op=now()
        WHERE id=$1
      `, [id, einddatum, actief, uitstelbaar, gedrag]);
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
    const deleteType = String(body?.type || "");
    const id = Number(body.id);
    if (!Number.isInteger(id)) throw new Error("Ongeldig id");

    const client = await db.getClient();
    try {
      await client.query("BEGIN");

      if (deleteType === "stroom") {
        const target = await client.query(`
          SELECT id, naam, actief
          FROM cashflow_stromen
          WHERE id = $1
          FOR UPDATE
        `, [id]);

        if (!target.rowCount) throw new Error("Geldstroom niet gevonden");
        if (target.rows[0].actief !== true) {
          throw new Error("Deze geldstroom is al verwijderd uit de actieve cashflow");
        }

        const dependents = await client.query(`
          SELECT naam
          FROM cashflow_stromen
          WHERE actief = true
            AND bron_stroom_id = $1
          ORDER BY naam
        `, [id]);

        if (dependents.rowCount) {
          const names = dependents.rows.map((row) => String(row.naam)).join(", ");
          throw new Error(
            `Deze geldstroom kan niet worden verwijderd omdat actieve geldstromen ervan afhankelijk zijn: ${names}`
          );
        }

        await client.query(`
          UPDATE cashflow_stromen
          SET actief = false,
              bijgewerkt_op = now()
          WHERE id = $1
        `, [id]);
      } else if (deleteType === "bedrag") {
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
            "De laatste tariefregel van een geldstroom kan niet worden verwijderd. Verwijder de geldstroom zelf als de hele post vervalt."
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
      } else {
        throw new Error("Onbekend verwijdertype");
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
    const inputType = String(body?.type || "");

    if (inputType === "vaste_stroom") {
      const naam = String(body.naam || "").trim();
      const categorie = String(body.categorie || "").trim();
      const frequentie = String(body.frequentie || "").trim();
      const geldigVanaf = String(body.geldig_vanaf || "").trim();
      const vanEntiteitId =
        body.van_entiteit_id === null ||
        body.van_entiteit_id === undefined ||
        body.van_entiteit_id === ""
          ? null
          : Number(body.van_entiteit_id);
      const naarEntiteitId =
        body.naar_entiteit_id === null ||
        body.naar_entiteit_id === undefined ||
        body.naar_entiteit_id === ""
          ? null
          : Number(body.naar_entiteit_id);
      const tegenpartijNaamRaw = String(body.tegenpartij_naam || "").trim();
      const bedrag = toNumberOrNull(body.bedrag);
      const btw = toNumberOrNull(body.btw_percentage) ?? 0;
      const aftrek = toNumberOrNull(body.btw_aftrekbaar_percentage) ?? 0;
      const uitstelbaar = Boolean(body.uitstelbaar);
      const inclusiefBtw = body.bedrag_is_inclusief_btw !== false;

      if (!naam) throw new Error("Naam is verplicht");
      if (!categorie) throw new Error("Categorie is verplicht");
      if (!frequentie) throw new Error("Frequentie is verplicht");
      if (!geldigVanaf) throw new Error("Ingangsdatum is verplicht");
      if (bedrag === null || bedrag < 0) {
        throw new Error("Bedrag moet 0 of hoger zijn");
      }
      if (btw < 0 || btw > 100) {
        throw new Error("BTW-percentage moet tussen 0 en 100 liggen");
      }
      if (aftrek < 0 || aftrek > 100) {
        throw new Error("BTW-aftrek moet tussen 0 en 100 liggen");
      }
      if (
        vanEntiteitId !== null &&
        !Number.isInteger(vanEntiteitId)
      ) {
        throw new Error("Ongeldige van-entiteit");
      }
      if (
        naarEntiteitId !== null &&
        !Number.isInteger(naarEntiteitId)
      ) {
        throw new Error("Ongeldige naar-entiteit");
      }
      if (vanEntiteitId === null && naarEntiteitId === null) {
        throw new Error("Kies minimaal een van- of naar-entiteit");
      }
      if (
        vanEntiteitId !== null &&
        naarEntiteitId !== null &&
        vanEntiteitId === naarEntiteitId
      ) {
        throw new Error("Van- en naar-entiteit mogen niet hetzelfde zijn");
      }

      const tegenpartijNaam =
        vanEntiteitId !== null && naarEntiteitId !== null
          ? null
          : tegenpartijNaamRaw || null;

      const client = await db.getClient();
      let createdStreamId: number | null = null;

      try {
        await client.query("BEGIN");

        const entityIds = [vanEntiteitId, naarEntiteitId].filter(
          (id): id is number => id !== null
        );

        const validEntities = await client.query(
          `
            SELECT id
            FROM cashflow_entiteiten
            WHERE actief = true
              AND id = ANY($1::int[])
          `,
          [entityIds]
        );

        if (validEntities.rowCount !== entityIds.length) {
          throw new Error("Een gekozen entiteit bestaat niet of is niet actief");
        }

        const validFrequency = await client.query(
          `
            SELECT 1
            FROM cashflow_stromen
            WHERE frequentie = $1
            LIMIT 1
          `,
          [frequentie]
        );

        if (!validFrequency.rowCount) {
          throw new Error(
            "Onbekende frequentie. Kies een frequentie die al in de cashflow wordt gebruikt."
          );
        }

        const duplicate = await client.query(
          `
            SELECT id
            FROM cashflow_stromen
            WHERE actief = true
              AND lower(trim(naam)) = lower(trim($1))
              AND van_entiteit_id IS NOT DISTINCT FROM $2::int
              AND naar_entiteit_id IS NOT DISTINCT FROM $3::int
            LIMIT 1
          `,
          [naam, vanEntiteitId, naarEntiteitId]
        );

        if (duplicate.rowCount) {
          throw new Error(
            "Er bestaat al een actieve geldstroom met deze naam en dezelfde richting"
          );
        }

        const template = await client.query(
          `
            SELECT
              s.gedrag,
              s.berekeningswijze,
              s.fiscale_behandeling
            FROM cashflow_stromen s
            WHERE s.actief = true
              AND EXISTS (
                SELECT 1
                FROM cashflow_stroom_bedragen b
                WHERE b.stroom_id = s.id
                  AND b.bedrag IS NOT NULL
                  AND b.percentage_van_bron IS NULL
              )
            ORDER BY
              (
                (s.van_entiteit_id IS NULL) = ($2::int IS NULL)
                AND
                (s.naar_entiteit_id IS NULL) = ($3::int IS NULL)
              ) DESC,
              (s.frequentie = $1) DESC,
              (s.van_entiteit_id IS NOT DISTINCT FROM $2::int) DESC,
              (s.naar_entiteit_id IS NOT DISTINCT FROM $3::int) DESC,
              s.id
            LIMIT 1
          `,
          [frequentie, vanEntiteitId, naarEntiteitId]
        );

        if (!template.rowCount) {
          throw new Error(
            "Geen bestaande vaste geldstroom gevonden om de technische instellingen van over te nemen"
          );
        }

        const templateRow = template.rows[0];
        const gedrag = uitstelbaar
          ? "planbaar"
          : String(templateRow.gedrag) === "planbaar"
            ? "vast"
            : String(templateRow.gedrag);

        const insertedStream = await client.query(
          `
            INSERT INTO cashflow_stromen (
              naam,
              categorie,
              van_entiteit_id,
              naar_entiteit_id,
              tegenpartij_naam,
              gedrag,
              uitstelbaar,
              frequentie,
              startdatum,
              einddatum,
              actief,
              bron_stroom_id,
              berekeningswijze,
              fiscale_behandeling
            )
            VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9::date,NULL,true,NULL,$10,$11
            )
            RETURNING id
          `,
          [
            naam,
            categorie,
            vanEntiteitId,
            naarEntiteitId,
            tegenpartijNaam,
            gedrag,
            uitstelbaar,
            frequentie,
            geldigVanaf,
            templateRow.berekeningswijze,
            templateRow.fiscale_behandeling,
          ]
        );

        createdStreamId = Number(insertedStream.rows[0]?.id);
        if (!Number.isInteger(createdStreamId)) {
          throw new Error("Nieuwe geldstroom kon niet worden aangemaakt");
        }

        await client.query(
          `
            INSERT INTO cashflow_stroom_bedragen (
              stroom_id,
              geldig_vanaf,
              geldig_tot,
              bedrag,
              percentage_van_bron,
              btw_percentage,
              btw_aftrekbaar_percentage,
              bedrag_is_inclusief_btw
            )
            VALUES ($1,$2::date,NULL,$3,NULL,$4,$5,$6)
          `,
          [
            createdStreamId,
            geldigVanaf,
            bedrag,
            btw,
            aftrek,
            inclusiefBtw,
          ]
        );

        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }

      return NextResponse.json({
        success: true,
        createdStreamId,
        data: await getData(),
      });
    }

    if (inputType !== "bedrag") {
      return NextResponse.json(
        { success: false, error: "Onbekend invoertype" },
        { status: 400 }
      );
    }

    const stroomId = Number(body.stroom_id);
    const geldigVanaf = String(body.geldig_vanaf || "");
    const geldigTot = body.geldig_tot ? String(body.geldig_tot) : null;
    const bedrag = toNumberOrNull(body.bedrag);
    const percentage = toNumberOrNull(body.percentage_van_bron);
    const btw = toNumberOrNull(body.btw_percentage) ?? 0;
    const aftrek = toNumberOrNull(body.btw_aftrekbaar_percentage) ?? 100;

    if (!Number.isInteger(stroomId) || !geldigVanaf) {
      throw new Error("Stroom en ingangsdatum zijn verplicht");
    }
    if ((bedrag === null) === (percentage === null)) {
      throw new Error("Vul óf een bedrag óf een percentage in");
    }
    if (bedrag !== null && bedrag < 0) {
      throw new Error("Bedrag mag niet negatief zijn");
    }
    if (percentage !== null && (percentage < 0 || percentage > 100)) {
      throw new Error("Percentage moet tussen 0 en 100 liggen");
    }

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
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 400 }
    );
  }
}
