// src/app/api/admin/instructie-vragen/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OptieInput = {
  id?: string;
  tekst: string;
  is_correct: boolean;
  sortering: number;
};

function cleanString(value: unknown) {
  return String(value || "").trim();
}

function cleanBoolean(value: unknown) {
  return value === true || value === "true";
}

function cleanNumber(value: unknown, fallback = 100) {
  const nummer = Number(value);
  return Number.isFinite(nummer) ? nummer : fallback;
}

async function haalInstructiesOverzicht() {
  const result = await db.query(`
    SELECT
      i.id,
      i.nummer,
      i.titel,
      i.status,
      COALESCE(i.onboarding_verplicht, false) AS onboarding_verplicht,
      COALESCE(i.onboarding_fase, 'taakgericht') AS onboarding_fase,
      COALESCE(i.onboarding_volgorde, 999) AS onboarding_volgorde,
      COUNT(v.id)::int AS aantal_vragen
    FROM instructies i
    LEFT JOIN instructie_vragen v
      ON v.instructie_id = i.id
     AND v.actief = true
    WHERE i.status = 'actief'
    GROUP BY
      i.id,
      i.nummer,
      i.titel,
      i.status,
      i.onboarding_verplicht,
      i.onboarding_fase,
      i.onboarding_volgorde
    ORDER BY
      COALESCE(i.onboarding_volgorde, 999),
      i.nummer ASC NULLS LAST,
      i.titel ASC
  `);

  return result.rows;
}

async function haalInstructieMetVragen(instructieId: string) {
  const instructieResult = await db.query(
    `
    SELECT
      id,
      nummer,
      titel,
      slug,
      inhoud,
      status,
      COALESCE(onboarding_verplicht, false) AS onboarding_verplicht,
      COALESCE(onboarding_fase, 'taakgericht') AS onboarding_fase,
      COALESCE(onboarding_volgorde, 999) AS onboarding_volgorde
    FROM instructies
    WHERE id = $1
    LIMIT 1
    `,
    [instructieId]
  );

  const instructie = instructieResult.rows[0];

  if (!instructie) {
    return null;
  }

  const vragenResult = await db.query(
    `
    SELECT
      id,
      instructie_id,
      vraag,
      uitleg,
      type,
      verplicht,
      sortering,
      actief
    FROM instructie_vragen
    WHERE instructie_id = $1
      AND actief = true
    ORDER BY sortering ASC, aangemaakt_op ASC
    `,
    [instructieId]
  );

  const vragen = vragenResult.rows;

  if (vragen.length === 0) {
    return {
      instructie,
      vragen: [],
    };
  }

  const vraagIds = vragen.map((vraag) => vraag.id);

  const optiesResult = await db.query(
    `
    SELECT
      id,
      vraag_id,
      tekst,
      is_correct,
      sortering,
      actief
    FROM instructie_vraag_opties
    WHERE vraag_id = ANY($1::uuid[])
      AND actief = true
    ORDER BY sortering ASC, aangemaakt_op ASC
    `,
    [vraagIds]
  );

  const optiesPerVraag = new Map<string, any[]>();

  for (const optie of optiesResult.rows) {
    const vraagId = String(optie.vraag_id);

    if (!optiesPerVraag.has(vraagId)) {
      optiesPerVraag.set(vraagId, []);
    }

    optiesPerVraag.get(vraagId)!.push({
      id: optie.id,
      vraag_id: optie.vraag_id,
      tekst: optie.tekst,
      is_correct: optie.is_correct,
      sortering: optie.sortering,
    });
  }

  return {
    instructie,
    vragen: vragen.map((vraag) => ({
      ...vraag,
      opties: optiesPerVraag.get(String(vraag.id)) || [],
    })),
  };
}

async function opslaanVraag(body: any) {
  const instructieId = cleanString(body?.instructie_id);
  const vraagId = cleanString(body?.id);
  const vraag = cleanString(body?.vraag);
  const uitleg = cleanString(body?.uitleg);
  const type = cleanString(body?.type) || "multiple_choice";
  const verplicht = body?.verplicht !== false;
  const sortering = cleanNumber(body?.sortering, 100);

  const opties: OptieInput[] = Array.isArray(body?.opties)
    ? body.opties.map((optie: any, index: number) => ({
        id: cleanString(optie?.id) || undefined,
        tekst: cleanString(optie?.tekst),
        is_correct: cleanBoolean(optie?.is_correct),
        sortering: cleanNumber(optie?.sortering, (index + 1) * 10),
      }))
    : [];

  if (!instructieId) {
    return {
      ok: false,
      status: 400,
      response: {
        success: false,
        error: "instructie_id ontbreekt.",
      },
    };
  }

  if (!vraag) {
    return {
      ok: false,
      status: 400,
      response: {
        success: false,
        error: "Vraagtekst ontbreekt.",
      },
    };
  }

  if (type !== "multiple_choice" && type !== "bevestiging") {
    return {
      ok: false,
      status: 400,
      response: {
        success: false,
        error: "Ongeldig vraagtype.",
      },
    };
  }

  if (type === "multiple_choice") {
    const geldigeOpties = opties.filter((optie) => optie.tekst);

    if (geldigeOpties.length < 2) {
      return {
        ok: false,
        status: 400,
        response: {
          success: false,
          error: "Een multiplechoicevraag heeft minimaal twee opties nodig.",
        },
      };
    }

    const aantalCorrect = geldigeOpties.filter((optie) => optie.is_correct).length;

    if (aantalCorrect !== 1) {
      return {
        ok: false,
        status: 400,
        response: {
          success: false,
          error: "Een multiplechoicevraag moet precies één correct antwoord hebben.",
        },
      };
    }
  }

  let opgeslagenVraagId = vraagId;

  if (vraagId) {
    const updateResult = await db.query(
      `
      UPDATE instructie_vragen
      SET
        vraag = $2,
        uitleg = NULLIF($3, ''),
        type = $4,
        verplicht = $5,
        sortering = $6,
        actief = true,
        bijgewerkt_op = NOW()
      WHERE id = $1
      RETURNING id
      `,
      [vraagId, vraag, uitleg, type, verplicht, sortering]
    );

    if (updateResult.rowCount === 0) {
      return {
        ok: false,
        status: 404,
        response: {
          success: false,
          error: "Vraag niet gevonden.",
        },
      };
    }
  } else {
    const insertResult = await db.query(
      `
      INSERT INTO instructie_vragen (
        instructie_id,
        vraag,
        uitleg,
        type,
        verplicht,
        sortering,
        actief
      )
      VALUES ($1, $2, NULLIF($3, ''), $4, $5, $6, true)
      RETURNING id
      `,
      [instructieId, vraag, uitleg, type, verplicht, sortering]
    );

    opgeslagenVraagId = insertResult.rows[0].id;
  }

  if (type === "multiple_choice") {
    const geldigeOpties = opties.filter((optie) => optie.tekst);
    const behoudenOptieIds: string[] = [];

    for (const optie of geldigeOpties) {
      if (optie.id) {
        const updateOptie = await db.query(
          `
          UPDATE instructie_vraag_opties
          SET
            tekst = $2,
            is_correct = $3,
            sortering = $4,
            actief = true,
            bijgewerkt_op = NOW()
          WHERE id = $1
            AND vraag_id = $5
          RETURNING id
          `,
          [
            optie.id,
            optie.tekst,
            optie.is_correct,
            optie.sortering,
            opgeslagenVraagId,
          ]
        );

        if ((updateOptie.rowCount || 0) > 0) {
          behoudenOptieIds.push(optie.id);
        }
      } else {
        const insertOptie = await db.query(
          `
          INSERT INTO instructie_vraag_opties (
            vraag_id,
            tekst,
            is_correct,
            sortering,
            actief
          )
          VALUES ($1, $2, $3, $4, true)
          RETURNING id
          `,
          [
            opgeslagenVraagId,
            optie.tekst,
            optie.is_correct,
            optie.sortering,
          ]
        );

        behoudenOptieIds.push(insertOptie.rows[0].id);
      }
    }

    if (behoudenOptieIds.length > 0) {
      await db.query(
        `
        UPDATE instructie_vraag_opties
        SET
          actief = false,
          bijgewerkt_op = NOW()
        WHERE vraag_id = $1
          AND NOT (id = ANY($2::uuid[]))
        `,
        [opgeslagenVraagId, behoudenOptieIds]
      );
    }
  }

  if (type === "bevestiging") {
    await db.query(
      `
      UPDATE instructie_vraag_opties
      SET
        actief = false,
        bijgewerkt_op = NOW()
      WHERE vraag_id = $1
      `,
      [opgeslagenVraagId]
    );
  }

  const data = await haalInstructieMetVragen(instructieId);

  return {
    ok: true,
    status: 200,
    response: {
      success: true,
      vraagId: opgeslagenVraagId,
      data,
    },
  };
}

async function verwijderVraag(body: any) {
  const vraagId = cleanString(body?.id);

  if (!vraagId) {
    return {
      ok: false,
      status: 400,
      response: {
        success: false,
        error: "Vraag-id ontbreekt.",
      },
    };
  }

  const result = await db.query(
    `
    UPDATE instructie_vragen
    SET
      actief = false,
      bijgewerkt_op = NOW()
    WHERE id = $1
    RETURNING instructie_id
    `,
    [vraagId]
  );

  if (result.rowCount === 0) {
    return {
      ok: false,
      status: 404,
      response: {
        success: false,
        error: "Vraag niet gevonden.",
      },
    };
  }

  await db.query(
    `
    UPDATE instructie_vraag_opties
    SET
      actief = false,
      bijgewerkt_op = NOW()
    WHERE vraag_id = $1
    `,
    [vraagId]
  );

  const instructieId = result.rows[0].instructie_id;
  const data = await haalInstructieMetVragen(String(instructieId));

  return {
    ok: true,
    status: 200,
    response: {
      success: true,
      verwijderd: true,
      data,
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const instructieId = url.searchParams.get("instructie_id");

    if (!instructieId) {
      const instructies = await haalInstructiesOverzicht();

      return NextResponse.json({
        success: true,
        instructies,
      });
    }

    const data = await haalInstructieMetVragen(instructieId);

    if (!data) {
      return NextResponse.json(
        {
          success: false,
          error: "Instructie niet gevonden.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Vragen konden niet worden opgehaald: ${String(error)}`,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const actie = cleanString(body?.actie || "opslaan_vraag");

    if (actie === "opslaan_vraag") {
      const result = await opslaanVraag(body);

      return NextResponse.json(result.response, {
        status: result.status,
      });
    }

    if (actie === "verwijder_vraag") {
      const result = await verwijderVraag(body);

      return NextResponse.json(result.response, {
        status: result.status,
      });
    }

    return NextResponse.json(
      {
        success: false,
        error: "Onbekende actie.",
      },
      { status: 400 }
    );
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Vragen konden niet worden opgeslagen: ${String(error)}`,
      },
      { status: 500 }
    );
  }
}