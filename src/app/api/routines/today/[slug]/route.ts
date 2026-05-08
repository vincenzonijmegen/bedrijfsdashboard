//src/app/api/routines/today/[slug]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Frequentie = "D" | "W" | "2D" | "M" | "Q" | "H" | "Y";

type TaakRow = {
  id: number;
  naam: string;
  kleurcode: "roze" | "groen" | "geel" | null;
  reinigen: boolean;
  desinfecteren: boolean;
  frequentie: Frequentie;
  weekdagen: string[] | null;
  sortering: number;
  afgetekend_door_naam: string | null;
  afgetekend_op: string | null;
  status: "gedaan" | "overgeslagen" | null;
  bron: "medewerker" | "leiding" | null;
  overgeslagen_reden: string | null;
  laatst_gedaan_datum: string | null;
  isPeriodiek?: boolean;
  vervaldatum?: string | null;
  isRotatie?: boolean;
  rotatieItemId?: number;
};

const WEEKDAGEN = ["zo", "ma", "di", "wo", "do", "vr", "za"];
const ISO_EVEN_REFERENCE = new Date("2026-01-05T00:00:00");

const PERIODIEKE_FREQUENTIES: Frequentie[] = ["M", "Q", "H", "Y"];

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dagenVerschil(a: Date, b: Date) {
  const utcA = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const utcB = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((utcA - utcB) / 86400000);
}

function addFrequentieInterval(datum: Date, frequentie: Frequentie) {
  const result = new Date(datum);

  if (frequentie === "M") result.setMonth(result.getMonth() + 1);
  if (frequentie === "Q") result.setMonth(result.getMonth() + 3);
  if (frequentie === "H") result.setMonth(result.getMonth() + 6);
  if (frequentie === "Y") result.setFullYear(result.getFullYear() + 1);

  return startOfDay(result);
}

function taakIsPeriodiek(taak: TaakRow) {
  return PERIODIEKE_FREQUENTIES.includes(taak.frequentie);
}

function taakIsVandaagZichtbaar(taak: TaakRow, vandaag: Date) {
  const weekdagen = Array.isArray(taak.weekdagen) ? taak.weekdagen : [];
  const vandaagCode = WEEKDAGEN[vandaag.getDay()];

  // Als een periodieke taak vandaag al is afgetekend, moet hij vandaag zichtbaar blijven
  // zodat de lijst netjes compleet/afgerond toont.
  if (taakIsPeriodiek(taak) && taak.afgetekend_op) {
    return true;
  }

  // Periodieke taken blijven zichtbaar vanaf vervaldatum totdat ze opnieuw gedaan zijn.
  if (taakIsPeriodiek(taak)) {
    if (!taak.laatst_gedaan_datum) return true;

    const laatstGedaan = startOfDay(new Date(taak.laatst_gedaan_datum));
    const vervaldatum = addFrequentieInterval(laatstGedaan, taak.frequentie);

    return vervaldatum <= startOfDay(vandaag);
  }

  // Bestaande dag-/weeklogica blijft intact.
  if (weekdagen.length > 0 && !weekdagen.includes(vandaagCode)) return false;

  if (taak.frequentie === "2D") {
    return dagenVerschil(vandaag, ISO_EVEN_REFERENCE) % 2 === 0;
  }

  return true;
}

function bepaalVervaldatum(taak: TaakRow) {
  if (!taakIsPeriodiek(taak)) return null;
  if (!taak.laatst_gedaan_datum) return null;

  return addFrequentieInterval(
    new Date(taak.laatst_gedaan_datum),
    taak.frequentie
  )
    .toISOString()
    .slice(0, 10);
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

        vandaag.afgetekend_door_naam,
        vandaag.afgetekend_op,
        vandaag.status,
        vandaag.bron,
        vandaag.overgeslagen_reden,

        laatst.datum AS laatst_gedaan_datum

      FROM routine_taken t

      LEFT JOIN routine_aftekeningen vandaag
        ON vandaag.routine_taak_id = t.id
       AND vandaag.datum = $2::date

      LEFT JOIN LATERAL (
        SELECT a.datum
        FROM routine_aftekeningen a
        WHERE a.routine_taak_id = t.id
          AND a.status = 'gedaan'
          AND a.afgetekend_op IS NOT NULL
        ORDER BY a.datum DESC, a.afgetekend_op DESC
        LIMIT 1
      ) laatst ON true

      WHERE t.routine_id = $1
        AND t.actief = true

      ORDER BY t.sortering ASC, t.id ASC
      `,
      [routine.id, vandaag]
    );

    const alleTaken = takenResult.rows as TaakRow[];

    const zichtbareTaken = alleTaken
      .filter((taak) => taakIsVandaagZichtbaar(taak, datum))
      .map((taak) => ({
        ...taak,
        isPeriodiek: taakIsPeriodiek(taak),
        vervaldatum: bepaalVervaldatum(taak),
      }));

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
        laatst_gedaan_datum: null,
        isPeriodiek: false,
        vervaldatum: null,
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