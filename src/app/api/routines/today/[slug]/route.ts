import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TaakRow = {
  id: number;
  naam: string;
  kleurcode: "roze" | "groen" | "geel" | null;
  reinigen: boolean;
  desinfecteren: boolean;
  frequentie: "D" | "W" | "2D";
  weekdagen: string[] | null;
  sortering: number;
  afgetekend_door_naam: string | null;
  afgetekend_op: string | null;
  status: "gedaan" | "overgeslagen" | null;
  bron: "medewerker" | "leiding" | null;
  overgeslagen_reden: string | null;
  isRotatie?: boolean;
  rotatieItemId?: number;
};

const WEEKDAGEN = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const ISO_EVEN_REFERENCE = new Date("2026-01-05T00:00:00");

function dagenVerschil(a: Date, b: Date) {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcA - utcB) / 86400000);
}

function taakIsVandaagZichtbaar(taak: TaakRow, vandaag: Date) {
  const weekdagen = Array.isArray(taak.weekdagen) ? taak.weekdagen : [];
  const vandaagCode = WEEKDAGEN[vandaag.getDay()];

  if (weekdagen.length > 0 && !weekdagen.includes(vandaagCode)) return false;

  if (taak.frequentie === "2D") {
    return dagenVerschil(vandaag, ISO_EVEN_REFERENCE) % 2 === 0;
  }

  return true;
}

async function getVandaagAfgetekendeRotatieTaak(
  routineId: number,
  vandaag: string
) {
  const result = await db.query(
    `
    SELECT i.*
    FROM routine_rotatie_aftekeningen a
    JOIN routine_rotatie_items i ON i.id = a.rotatie_item_id
    WHERE a.routine_id = $1
      AND a.datum = $2::date
    ORDER BY a.afgetekend_op DESC
    LIMIT 1
    `,
    [routineId, vandaag]
  );

  return result.rows[0] ?? null;
}

async function getActieveRotatieTaak(routineId: number) {
  const status = await db.query(
    `
    SELECT vitrines_sinds_bewaarkast
    FROM routine_rotatie_status
    WHERE routine_id = $1
    LIMIT 1
    `,
    [routineId]
  );

  const teller = Number(status.rows[0]?.vitrines_sinds_bewaarkast ?? 0);
  const gewensteRotatieNaam = teller >= 3 ? "Bewaarkasten" : "Vitrines";

  const item = await db.query(
    `
    SELECT i.*
    FROM routine_rotaties r
    JOIN routine_rotatie_items i ON i.rotatie_id = r.id
    WHERE r.routine_id = $1
      AND r.actief = true
      AND r.naam = $2
    ORDER BY i.sortering ASC, i.id ASC
    LIMIT 1
    `,
    [routineId, gewensteRotatieNaam]
  );

  return item.rows[0] ?? null;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const datum = new Date();
    const vandaag = datum.toISOString().slice(0, 10);

    const routineResult = await db.query(
      `
      SELECT id, slug, naam, locatie, type
      FROM routines
      WHERE slug = $1
        AND actief = true
      LIMIT 1
      `,
      [slug]
    );

    if (routineResult.rowCount === 0) {
      return NextResponse.json(
        { error: "Routine niet gevonden" },
        { status: 404 }
      );
    }

    const routine = routineResult.rows[0];

    const takenResult = await db.query(
      `
      SELECT
        t.id,
        t.naam,
        t.kleurcode,
        t.reinigen,
        t.desinfecteren,
        t.frequentie,
        COALESCE(t.weekdagen, '[]'::jsonb) AS weekdagen,
        t.sortering,
        a.afgetekend_door_naam,
        a.afgetekend_op,
        a.status,
        a.bron,
        a.overgeslagen_reden
      FROM routine_taken t
      LEFT JOIN routine_aftekeningen a
        ON a.routine_taak_id = t.id
       AND a.datum = $2::date
      WHERE t.routine_id = $1
        AND t.actief = true
      ORDER BY t.sortering ASC, t.id ASC
      `,
      [routine.id, vandaag]
    );

    const alleTaken = takenResult.rows as TaakRow[];
    const zichtbareTaken = alleTaken.filter((taak) =>
      taakIsVandaagZichtbaar(taak, datum)
    );

    let rotatieTaak = await getVandaagAfgetekendeRotatieTaak(
      Number(routine.id),
      vandaag
    );

    if (!rotatieTaak) {
      const override = await db.query(
        `
        SELECT rotatie_item_id
        FROM routine_rotatie_override
        WHERE routine_id = $1
          AND datum = $2::date
        LIMIT 1
        `,
        [routine.id, vandaag]
      );

      if (override.rows.length > 0) {
        const overrideItemId = override.rows[0].rotatie_item_id;

        if (overrideItemId) {
          const item = await db.query(
            `
            SELECT *
            FROM routine_rotatie_items
            WHERE id = $1
            `,
            [overrideItemId]
          );

          rotatieTaak = item.rows[0] ?? null;
        } else {
          rotatieTaak = null;
        }
      } else {
        rotatieTaak = await getActieveRotatieTaak(Number(routine.id));
      }
    }

    const rotatieAftekeningResult = rotatieTaak
      ? await db.query(
          `
          SELECT afgetekend_door_naam, afgetekend_op
          FROM routine_rotatie_aftekeningen
          WHERE rotatie_item_id = $1
            AND datum = $2::date
          LIMIT 1
          `,
          [rotatieTaak.id, vandaag]
        )
      : null;

    const rotatieAftekening = rotatieAftekeningResult?.rows?.[0] ?? null;

    if (rotatieTaak) {
      zichtbareTaken.unshift({
        id: -rotatieTaak.id,
        naam: rotatieTaak.naam,
        kleurcode: null,
        reinigen: true,
        desinfecteren: false,
        frequentie: "D",
        weekdagen: [],
        sortering: 0,
        afgetekend_door_naam:
          rotatieAftekening?.afgetekend_door_naam ?? null,
        afgetekend_op: rotatieAftekening?.afgetekend_op ?? null,
        status: null,
        bron: null,
        overgeslagen_reden: null,
        isRotatie: true,
        rotatieItemId: rotatieTaak.id,
      });
    }

    return NextResponse.json({
      datum: vandaag,
      routine,
      taken: zichtbareTaken,
      totaal: zichtbareTaken.length,
      afgerond: zichtbareTaken.filter((taak) => Boolean(taak.afgetekend_op))
        .length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Fout bij ophalen routine", details: String(error) },
      { status: 500 }
    );
  }
}