// src/app/api/admin/mail-instellingen/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAGBRIEFING_SLEUTEL = "dagbriefing";

function isValidEmail(value: unknown) {
  const email = String(value || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normaliseerEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

async function haalMailInstellingenOp() {
  const soortenResult = await db.query(
    `
    SELECT
      id,
      sleutel,
      naam,
      actief,
      alleen_versturen_bij_rooster,
      omschrijving,
      aangemaakt_op,
      bijgewerkt_op
    FROM management_mail_soorten
    WHERE sleutel = $1
    LIMIT 1
    `,
    [DAGBRIEFING_SLEUTEL]
  );

  let soort = soortenResult.rows[0] || null;

  if (!soort) {
    const insertResult = await db.query(
      `
      INSERT INTO management_mail_soorten (
        sleutel,
        naam,
        actief,
        alleen_versturen_bij_rooster,
        omschrijving
      )
      VALUES (
        $1,
        'Dagbriefing management',
        true,
        false,
        'Dagelijkse managementbriefing met weer, rooster, sollicitanten, HACCP en bijzonderheden.'
      )
      RETURNING
        id,
        sleutel,
        naam,
        actief,
        alleen_versturen_bij_rooster,
        omschrijving,
        aangemaakt_op,
        bijgewerkt_op
      `,
      [DAGBRIEFING_SLEUTEL]
    );

    soort = insertResult.rows[0];
  }

  const ontvangersResult = await db.query(
    `
    SELECT
      id,
      mail_soort_sleutel,
      naam,
      email,
      actief,
      aangemaakt_op,
      bijgewerkt_op
    FROM management_mail_ontvangers
    WHERE mail_soort_sleutel = $1
    ORDER BY actief DESC, naam ASC NULLS LAST, email ASC
    `,
    [DAGBRIEFING_SLEUTEL]
  );

  return {
    soort,
    ontvangers: ontvangersResult.rows,
  };
}

export async function GET() {
  try {
    const data = await haalMailInstellingenOp();

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Mailinstellingen konden niet worden opgehaald: ${String(error)}`,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const naam =
      body?.naam === null || body?.naam === undefined
        ? null
        : String(body.naam).trim();

    const email = normaliseerEmail(body?.email);
    const actief = body?.actief === undefined ? true : Boolean(body.actief);

    if (!isValidEmail(email)) {
      return NextResponse.json(
        {
          success: false,
          error: "Vul een geldig e-mailadres in.",
        },
        { status: 400 }
      );
    }

    const result = await db.query(
      `
      INSERT INTO management_mail_ontvangers (
        mail_soort_sleutel,
        naam,
        email,
        actief
      )
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (mail_soort_sleutel, email)
      DO UPDATE SET
        naam = EXCLUDED.naam,
        actief = EXCLUDED.actief,
        bijgewerkt_op = NOW()
      RETURNING
        id,
        mail_soort_sleutel,
        naam,
        email,
        actief,
        aangemaakt_op,
        bijgewerkt_op
      `,
      [DAGBRIEFING_SLEUTEL, naam || null, email, actief]
    );

    return NextResponse.json({
      success: true,
      ontvanger: result.rows[0],
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Ontvanger kon niet worden opgeslagen: ${String(error)}`,
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();

    if (body?.type === "soort") {
      const actief =
        body?.actief === undefined ? null : Boolean(body.actief);

      const alleenVersturenBijRooster =
        body?.alleen_versturen_bij_rooster === undefined
          ? null
          : Boolean(body.alleen_versturen_bij_rooster);

      if (actief === null && alleenVersturenBijRooster === null) {
        return NextResponse.json(
          {
            success: false,
            error: "Geen wijziging ontvangen.",
          },
          { status: 400 }
        );
      }

      const result = await db.query(
        `
        UPDATE management_mail_soorten
        SET
          actief = COALESCE($2, actief),
          alleen_versturen_bij_rooster = COALESCE($3, alleen_versturen_bij_rooster),
          bijgewerkt_op = NOW()
        WHERE sleutel = $1
        RETURNING
          id,
          sleutel,
          naam,
          actief,
          alleen_versturen_bij_rooster,
          omschrijving,
          aangemaakt_op,
          bijgewerkt_op
        `,
        [DAGBRIEFING_SLEUTEL, actief, alleenVersturenBijRooster]
      );

      return NextResponse.json({
        success: true,
        soort: result.rows[0],
      });
    }

    if (body?.type === "ontvanger") {
      const id = Number(body?.id);

      if (!Number.isInteger(id) || id <= 0) {
        return NextResponse.json(
          {
            success: false,
            error: "Ongeldig ontvanger-id.",
          },
          { status: 400 }
        );
      }

      const naam =
        body?.naam === undefined ? undefined : String(body.naam || "").trim();

      const email =
        body?.email === undefined ? undefined : normaliseerEmail(body.email);

      const actief =
        body?.actief === undefined ? undefined : Boolean(body.actief);

      if (email !== undefined && !isValidEmail(email)) {
        return NextResponse.json(
          {
            success: false,
            error: "Vul een geldig e-mailadres in.",
          },
          { status: 400 }
        );
      }

      const huidigResult = await db.query(
        `
        SELECT id, naam, email, actief
        FROM management_mail_ontvangers
        WHERE id = $1
          AND mail_soort_sleutel = $2
        LIMIT 1
        `,
        [id, DAGBRIEFING_SLEUTEL]
      );

      const huidig = huidigResult.rows[0];

      if (!huidig) {
        return NextResponse.json(
          {
            success: false,
            error: "Ontvanger niet gevonden.",
          },
          { status: 404 }
        );
      }

      const result = await db.query(
        `
        UPDATE management_mail_ontvangers
        SET
          naam = $2,
          email = $3,
          actief = $4,
          bijgewerkt_op = NOW()
        WHERE id = $1
          AND mail_soort_sleutel = $5
        RETURNING
          id,
          mail_soort_sleutel,
          naam,
          email,
          actief,
          aangemaakt_op,
          bijgewerkt_op
        `,
        [
          id,
          naam === undefined ? huidig.naam : naam || null,
          email === undefined ? huidig.email : email,
          actief === undefined ? huidig.actief : actief,
          DAGBRIEFING_SLEUTEL,
        ]
      );

      return NextResponse.json({
        success: true,
        ontvanger: result.rows[0],
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Onbekend wijzigingstype.",
      },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Mailinstelling kon niet worden gewijzigd: ${String(error)}`,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const id = Number(req.nextUrl.searchParams.get("id"));

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Ongeldig ontvanger-id.",
        },
        { status: 400 }
      );
    }

    const result = await db.query(
      `
      DELETE FROM management_mail_ontvangers
      WHERE id = $1
        AND mail_soort_sleutel = $2
      RETURNING id
      `,
      [id, DAGBRIEFING_SLEUTEL]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Ontvanger niet gevonden.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      deletedId: id,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Ontvanger kon niet worden verwijderd: ${String(error)}`,
      },
      { status: 500 }
    );
  }
}