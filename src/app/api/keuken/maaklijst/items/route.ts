import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const AUTOMATISCHE_SCHOONMAAK_TAKEN: Record<
  string,
  { schoonmaakNaam: string }
> = {
  melkmix: {
    schoonmaakNaam: "kleppen en kranen pasteuriseerketel melk schoonmaken",
  },
  vruchtenmix: {
    schoonmaakNaam: "kleppen en kranen pasteuriseerketel vruchten schoonmaken",
  },
};

const MIXEN_PER_SCHOONMAAKBEURT = 6;

async function schuifOpenAutomatischeSchoonmaakTakenDoor(
  maaklijstId: number,
  locatie: string
) {
  const schoonmaakNamen = Object.values(AUTOMATISCHE_SCHOONMAAK_TAKEN).map(
    (taak) => taak.schoonmaakNaam
  );

  await db.query(
    `
    UPDATE maaklijst_items mi
    SET
      maaklijst_id = $1,
      bijgewerkt_op = NOW()
    FROM maaklijsten oude_lijst
    WHERE mi.maaklijst_id = oude_lijst.id
      AND mi.status = 'open'
      AND LOWER(mi.naam) = ANY($2::text[])
      AND oude_lijst.locatie = $3
      AND mi.maaklijst_id <> $1
    `,
    [
      maaklijstId,
      schoonmaakNamen.map((naam) => naam.toLowerCase()),
      locatie,
    ]
  );
}

async function getOrCreateMaaklijstId(datum: string, locatie: string) {
  const existing = await db.query(
    `
    SELECT id
    FROM maaklijsten
    WHERE datum = $1::date
      AND locatie = $2
    LIMIT 1
    `,
    [datum, locatie]
  );

  let maaklijstId: number;

  if (existing.rowCount && existing.rows[0]?.id) {
    maaklijstId = Number(existing.rows[0].id);
  } else {
    const created = await db.query(
      `
      INSERT INTO maaklijsten (datum, locatie, status)
      VALUES ($1::date, $2, 'open')
      RETURNING id
      `,
      [datum, locatie]
    );

    maaklijstId = Number(created.rows[0].id);
  }

  // Een niet-uitgevoerde automatische schoonmaaktaak mag niet op een oude
  // maaklijst achterblijven. Hij verhuist naar de actuele maaklijst en blijft
  // daar open staan totdat iemand hem daadwerkelijk afhandelt.
  await schuifOpenAutomatischeSchoonmaakTakenDoor(maaklijstId, locatie);

  return maaklijstId;
}

async function maakAutomatischeSchoonmaakTaakIndienNodig(item: {
  naam: string;
  maaklijst_id: number;
  toegevoegdAantal: number;
}) {
  const itemNaam = String(item.naam || "").trim().toLowerCase();

  const sleutel = itemNaam.includes("melkmix")
    ? "melkmix"
    : itemNaam.includes("vruchtenmix")
      ? "vruchtenmix"
      : null;

  if (!sleutel || item.toegevoegdAantal <= 0) return;

  const schoonmaakRegel = AUTOMATISCHE_SCHOONMAAK_TAKEN[sleutel];

  const tellerResult = await db.query(
    `
    SELECT COALESCE(SUM(aantal), 0)::int AS aantal
    FROM maaklijst_items
    WHERE LOWER(naam) LIKE $1
    `,
    [`%${sleutel}%`]
  );

  const totaalNaToevoeging = Number(tellerResult.rows[0]?.aantal || 0);
  const totaalVoorToevoeging = Math.max(
    0,
    totaalNaToevoeging - item.toegevoegdAantal
  );

  const cycliVoor = Math.floor(
    totaalVoorToevoeging / MIXEN_PER_SCHOONMAAKBEURT
  );
  const cycliNa = Math.floor(
    totaalNaToevoeging / MIXEN_PER_SCHOONMAAKBEURT
  );

  const nieuwGepasseerdeCycli = cycliNa - cycliVoor;

  if (nieuwGepasseerdeCycli <= 0) return;

  // Als dezelfde schoonmaakverplichting nog openstaat, blijft die ene taak
  // leidend. Door getOrCreateMaaklijstId staat hij inmiddels op de actuele
  // maaklijst. We maken dan geen tweede identieke open taak aan.
  const bestaandOpenResult = await db.query(
    `
    SELECT id
    FROM maaklijst_items
    WHERE LOWER(naam) = LOWER($1)
      AND status = 'open'
    LIMIT 1
    `,
    [schoonmaakRegel.schoonmaakNaam]
  );

  if (bestaandOpenResult.rowCount && bestaandOpenResult.rows[0]?.id) {
    return;
  }

  await db.query(
    `
    INSERT INTO maaklijst_items
      (maaklijst_id, recept_id, categorie, naam, maakvolgorde, aantal, status)
    VALUES
      ($1, 0, 'Schoonmaak', $2, 999, 1, 'open')
    `,
    [item.maaklijst_id, schoonmaakRegel.schoonmaakNaam]
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const datum =
      String(body?.datum || "").trim() ||
      new Date().toISOString().slice(0, 10);

    const locatie = String(body?.locatie || "keuken").trim();
    const receptId = Number(body?.recept_id);
    const categorie = String(body?.categorie || "").trim();
    const naam = String(body?.naam || "").trim();
    const maakvolgorde = Number(body?.maakvolgorde ?? 50);
    const aantal = Math.max(1, Number(body?.aantal ?? 1));

    if (!receptId || !categorie || !naam) {
      return NextResponse.json(
        { success: false, error: "recept_id, categorie en naam zijn verplicht" },
        { status: 400 }
      );
    }

    const maaklijstId = await getOrCreateMaaklijstId(datum, locatie);

    const existing = await db.query(
      `
      SELECT id, aantal, bijgewerkt_op
      FROM maaklijst_items
      WHERE maaklijst_id = $1
        AND recept_id = $2
        AND status = 'open'
      LIMIT 1
      `,
      [maaklijstId, receptId]
    );

    let result;
    let toegevoegdAantal = 0;

    if (existing.rowCount && existing.rows[0]?.id) {
      const laatsteWijziging = existing.rows[0].bijgewerkt_op
        ? new Date(existing.rows[0].bijgewerkt_op).getTime()
        : 0;

      const nu = Date.now();
      const isWaarschijnlijkDubbelklik = nu - laatsteWijziging < 3000;

      if (isWaarschijnlijkDubbelklik) {
        result = await db.query(
          `
          SELECT *
          FROM maaklijst_items
          WHERE id = $1
          `,
          [existing.rows[0].id]
        );
      } else {
        result = await db.query(
          `
          UPDATE maaklijst_items
          SET
            aantal = aantal + $1,
            bijgewerkt_op = NOW()
          WHERE id = $2
          RETURNING *
          `,
          [aantal, existing.rows[0].id]
        );
        toegevoegdAantal = aantal;
      }
    } else {
      try {
        result = await db.query(
          `
          INSERT INTO maaklijst_items
            (maaklijst_id, recept_id, categorie, naam, maakvolgorde, aantal, status)
          VALUES
            ($1, $2, $3, $4, $5, $6, 'open')
          RETURNING *
          `,
          [maaklijstId, receptId, categorie, naam, maakvolgorde, aantal]
        );
        toegevoegdAantal = aantal;
      } catch (error: any) {
        if (error?.code === "23505") {
          result = await db.query(
            `
            SELECT *
            FROM maaklijst_items
            WHERE maaklijst_id = $1
              AND recept_id = $2
              AND status = 'open'
            LIMIT 1
            `,
            [maaklijstId, receptId]
          );
        } else {
          throw error;
        }
      }
    }

    await maakAutomatischeSchoonmaakTaakIndienNodig({
      naam,
      maaklijst_id: maaklijstId,
      toegevoegdAantal,
    });

    await db.query(
      `
      UPDATE maaklijsten
      SET bijgewerkt_op = NOW()
      WHERE id = $1
      `,
      [maaklijstId]
    );

    return NextResponse.json({
      success: true,
      item: result.rows[0],
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Fout bij toevoegen aan maaklijst",
        details: String(error),
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();

    const id = Number(body?.id);
    const status = body?.status;
    const aantal =
      body?.aantal === undefined || body?.aantal === null
        ? null
        : Math.max(1, Number(body.aantal));

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is verplicht" },
        { status: 400 }
      );
    }

    const updates: string[] = [];
    const values: unknown[] = [];
    let i = 1;

    if (status === "open" || status === "afgehandeld") {
      updates.push(`status = $${i++}`);
      values.push(status);
    }

    if (aantal !== null) {
      updates.push(`aantal = $${i++}`);
      values.push(aantal);
    }

    updates.push(`bijgewerkt_op = NOW()`);

    if (updates.length === 1) {
      return NextResponse.json(
        { success: false, error: "Geen geldige wijziging meegegeven" },
        { status: 400 }
      );
    }

    values.push(id);

    const result = await db.query(
      `
      UPDATE maaklijst_items
      SET ${updates.join(", ")}
      WHERE id = $${i}
      RETURNING *
      `,
      values
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: "Item niet gevonden" },
        { status: 404 }
      );
    }

    const item = result.rows[0];

    await db.query(
      `
      UPDATE maaklijsten
      SET bijgewerkt_op = NOW()
      WHERE id = $1
      `,
      [item.maaklijst_id]
    );

    return NextResponse.json({
      success: true,
      item,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Fout bij wijzigen maaklijst-item",
        details: String(error),
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const id = Number(body?.id);

    if (!id) {
      return NextResponse.json(
        { success: false, error: "id is verplicht" },
        { status: 400 }
      );
    }

    const result = await db.query(
      `
      DELETE FROM maaklijst_items
      WHERE id = $1
      RETURNING id
      `,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: "Item niet gevonden" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Fout bij verwijderen maaklijst-item",
        details: String(error),
      },
      { status: 500 }
    );
  }
}