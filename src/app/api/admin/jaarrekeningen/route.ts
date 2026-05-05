import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const onderdelen = await query(`
      SELECT id, code, naam, sortering
      FROM jaarrekening_onderdelen
      ORDER BY sortering, id
    `);

    const rubrieken = await query(`
      SELECT id, onderdeel_id, naam, sortering, actief
      FROM jaarrekening_rubrieken
      WHERE actief = TRUE
      ORDER BY sortering, id
    `);

    const regels = await query(`
      SELECT
        r.id,
        r.rubriek_id,
        r.naam,
        r.sortering,
        r.is_totaal,
        r.actief,
        COALESCE(
          json_object_agg(b.jaar, b.bedrag) FILTER (WHERE b.jaar IS NOT NULL),
          '{}'::json
        ) AS bedragen
      FROM jaarrekening_regels r
      LEFT JOIN jaarrekening_bedragen b ON b.regel_id = r.id
      WHERE r.actief = TRUE
      GROUP BY r.id
      ORDER BY r.sortering, r.id
    `);

    const jaren = await query(`
      SELECT DISTINCT jaar
      FROM jaarrekening_bedragen
      ORDER BY jaar
    `);

    return NextResponse.json({
      success: true,
      onderdelen: onderdelen.rows,
      rubrieken: rubrieken.rows,
      regels: regels.rows,
      jaren: jaren.rows.map((r: any) => Number(r.jaar)),
    });
  } catch (error) {
    console.error("Fout bij ophalen jaarrekeningen:", error);
    return NextResponse.json(
      { success: false, error: "Fout bij ophalen jaarrekeningen" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.actie === "rubriek_toevoegen") {
      await query(
        `
        INSERT INTO jaarrekening_rubrieken (onderdeel_id, naam, sortering)
        VALUES ($1, $2, $3)
      `,
        [Number(body.onderdeel_id), body.naam, Number(body.sortering || 0)]
      );

      return NextResponse.json({ success: true });
    }

    if (body.actie === "regel_toevoegen") {
      await query(
        `
        INSERT INTO jaarrekening_regels (rubriek_id, naam, sortering, is_totaal)
        VALUES ($1, $2, $3, $4)
      `,
        [
          Number(body.rubriek_id),
          body.naam,
          Number(body.sortering || 0),
          Boolean(body.is_totaal),
        ]
      );

      return NextResponse.json({ success: true });
    }

    if (body.actie === "bedrag_opslaan") {
      await query(
        `
        INSERT INTO jaarrekening_bedragen (regel_id, jaar, bedrag)
        VALUES ($1, $2, $3)
        ON CONFLICT (regel_id, jaar)
        DO UPDATE SET bedrag = EXCLUDED.bedrag
      `,
        [
          Number(body.regel_id),
          Number(body.jaar),
          body.bedrag === "" || body.bedrag === null
            ? null
            : Number(body.bedrag),
        ]
      );

      return NextResponse.json({ success: true });
    }

    return NextResponse.json(
      { success: false, error: "Onbekende actie" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Fout bij opslaan jaarrekening:", error);
    return NextResponse.json(
      { success: false, error: "Fout bij opslaan jaarrekening" },
      { status: 500 }
    );
  }
}