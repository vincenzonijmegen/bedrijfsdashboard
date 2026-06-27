// src/app/api/admin/onboarding/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyJWT } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OnboardingFase = "voor_eerste_shift" | "binnen_2_weken" | "taakgericht";

const TOEGESTANE_LEESROLLEN = ["beheerder", "accountant"];
const TOEGESTANE_SCHRIJFROLLEN = ["beheerder"];

async function haalRolUitSessie(req: NextRequest) {
  const gebruikerJWT = verifyJWT(req);

  const result = await db.query(
    `SELECT rol
     FROM medewerkers
     WHERE lower(email) = lower($1)
     LIMIT 1`,
    [gebruikerJWT.email]
  );

  const gebruiker = result.rows[0];

  if (!gebruiker) {
    return null;
  }

  return String(gebruiker.rol || "").toLowerCase();
}

async function magLezen(req: NextRequest) {
  try {
    const rol = await haalRolUitSessie(req);
    return !!rol && TOEGESTANE_LEESROLLEN.includes(rol);
  } catch {
    return false;
  }
}

async function magSchrijven(req: NextRequest) {
  try {
    const rol = await haalRolUitSessie(req);
    return !!rol && TOEGESTANE_SCHRIJFROLLEN.includes(rol);
  } catch {
    return false;
  }
}

function normalizeFuncties(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function faseLabel(fase: string) {
  switch (fase) {
    case "voor_eerste_shift":
      return "Voor eerste shift";
    case "binnen_2_weken":
      return "Binnen 2 weken";
    case "taakgericht":
      return "Taakgericht / naslag";
    default:
      return "Taakgericht / naslag";
  }
}

function faseVolgorde(fase: string) {
  switch (fase) {
    case "voor_eerste_shift":
      return 1;
    case "binnen_2_weken":
      return 2;
    case "taakgericht":
      return 3;
    default:
      return 99;
  }
}

function medewerkerFuncties(medewerker: any): string[] {
  const functies = new Set<string>();
  const hoofdFunctie = String(medewerker.functie || "").trim();

  if (hoofdFunctie) {
    functies.add(hoofdFunctie);
  }

  // Scheppers overdag + avond mogen ook instructies zien die alleen voor
  // scheppers overdag gelden. Andersom niet.
  if (hoofdFunctie === "scheppers overdag + avond") {
    functies.add("scheppers overdag");
  }

  // Alleen als er géén duidelijke schepfunctie in het functieveld staat,
  // gebruiken we kan_scheppen als fallback.
  if (
    medewerker.kan_scheppen &&
    hoofdFunctie !== "scheppers overdag" &&
    hoofdFunctie !== "scheppers overdag + avond"
  ) {
    functies.add("scheppers overdag");
  }

  if (medewerker.kan_voorbereiden) {
    functies.add("ijsvoorbereiders");
  }

  if (medewerker.kan_ijsbereiden) {
    functies.add("keukenmedewerkers");
  }

  return Array.from(functies);
}

function instructieHoortBijMedewerker(
  instructie: any,
  functiesMedewerker: string[]
) {
  const functiesInstructie = normalizeFuncties(instructie.functies);

  if (functiesInstructie.length === 0) {
    return false;
  }

  return functiesInstructie.some((functie) =>
    functiesMedewerker.includes(functie)
  );
}

async function haalOnboardingDataOp() {
  const medewerkersResult = await db.query(`
    SELECT
      id,
      TRIM(naam) AS naam,
      email,
      functie,
      eerste_werkdag,
      COALESCE(kan_scheppen, false) AS kan_scheppen,
      COALESCE(kan_voorbereiden, false) AS kan_voorbereiden,
      COALESCE(kan_ijsbereiden, false) AS kan_ijsbereiden
    FROM medewerkers
    WHERE email IS NOT NULL
      AND email <> ''
    ORDER BY naam
  `);

  const instructiesResult = await db.query(`
    SELECT
      id,
      titel,
      slug,
      nummer,
      functies,
      COALESCE(onboarding_fase, 'taakgericht') AS onboarding_fase,
      COALESCE(onboarding_verplicht, false) AS onboarding_verplicht,
      COALESCE(onboarding_volgorde, 999) AS onboarding_volgorde
    FROM instructies
    WHERE status = 'actief'
      AND COALESCE(onboarding_verplicht, false) = true
    ORDER BY
      COALESCE(onboarding_volgorde, 999) ASC,
      nummer ASC NULLS LAST,
      titel ASC
  `);

  const gelezenResult = await db.query(`
    SELECT
      LOWER(email) AS email,
      instructie_id,
      gelezen_op
    FROM gelezen_instructies
  `);

  const opdrachtenResult = await db.query(`
    SELECT
      LOWER(medewerker_email) AS medewerker_email,
      instructie_id,
      status,
      verzonden_op,
      afgerond_op,
      token_verloopt_op,
      laatste_fout
    FROM onboarding_opdrachten
  `);

  const gelezenMap = new Map<string, any>();

  for (const row of gelezenResult.rows) {
    gelezenMap.set(`${row.email}::${String(row.instructie_id)}`, row);
  }

  const opdrachtMap = new Map<string, any>();

  for (const row of opdrachtenResult.rows) {
    opdrachtMap.set(`${row.medewerker_email}::${String(row.instructie_id)}`, row);
  }

  const items = medewerkersResult.rows.map((medewerker) => {
    const emailKey = String(medewerker.email || "").toLowerCase();
    const functies = medewerkerFuncties(medewerker);

    const verplichteInstructies = instructiesResult.rows
      .filter((instructie) => instructieHoortBijMedewerker(instructie, functies))
      .map((instructie) => {
        const key = `${emailKey}::${String(instructie.id)}`;
        const gelezenRow = gelezenMap.get(key);
        const opdrachtRow = opdrachtMap.get(key);

        const gelezen =
          Boolean(gelezenRow) || opdrachtRow?.status === "afgerond";

        return {
          id: instructie.id,
          titel: instructie.titel,
          slug: instructie.slug,
          nummer: instructie.nummer,
          functies: normalizeFuncties(instructie.functies),
          onboarding_fase: instructie.onboarding_fase as OnboardingFase,
          onboarding_fase_label: faseLabel(instructie.onboarding_fase),
          onboarding_volgorde: Number(instructie.onboarding_volgorde || 999),
          gelezen,
          gelezen_op: gelezenRow?.gelezen_op || opdrachtRow?.afgerond_op || null,

          // Voor dashboardcontrole
          onboarding_status: opdrachtRow?.status || null,
          onboarding_verzonden_op: opdrachtRow?.verzonden_op || null,
          onboarding_afgerond_op: opdrachtRow?.afgerond_op || null,
          onboarding_token_verloopt_op: opdrachtRow?.token_verloopt_op || null,
          onboarding_laatste_fout: opdrachtRow?.laatste_fout || null,
        };
      })
      .sort((a, b) => {
        const fase =
          faseVolgorde(a.onboarding_fase) - faseVolgorde(b.onboarding_fase);

        if (fase !== 0) return fase;

        const volgorde = a.onboarding_volgorde - b.onboarding_volgorde;

        if (volgorde !== 0) return volgorde;

        return String(a.nummer || "").localeCompare(String(b.nummer || ""));
      });

    const totaal = verplichteInstructies.length;
    const gelezen = verplichteInstructies.filter((i) => i.gelezen).length;
    const open = totaal - gelezen;

    const perFase = ["voor_eerste_shift", "binnen_2_weken", "taakgericht"].map(
      (fase) => {
        const instructies = verplichteInstructies.filter(
          (instructie) => instructie.onboarding_fase === fase
        );

        return {
          fase,
          label: faseLabel(fase),
          totaal: instructies.length,
          gelezen: instructies.filter((i) => i.gelezen).length,
          open: instructies.filter((i) => !i.gelezen).length,
          instructies,
        };
      }
    );

    return {
      medewerker: {
        id: medewerker.id,
        naam: medewerker.naam,
        email: medewerker.email,
        functie: medewerker.functie,
        functies,
        eerste_werkdag: medewerker.eerste_werkdag,
      },
      samenvatting: {
        totaal,
        gelezen,
        open,
        afgerond: open === 0,
      },
      perFase,
      openInstructies: verplichteInstructies.filter((i) => !i.gelezen),
    };
  });

  return {
    medewerkers: items,
    samenvatting: {
      medewerkers: items.length,
      afgerond: items.filter((item) => item.samenvatting.afgerond).length,
      metOpenTaken: items.filter((item) => item.samenvatting.open > 0).length,
      openInstructies: items.reduce(
        (totaal, item) => totaal + item.samenvatting.open,
        0
      ),
    },
  };
}

export async function GET(req: NextRequest) {
  try {
    const toegestaan = await magLezen(req);

    if (!toegestaan) {
      return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
    }

    const data = await haalOnboardingDataOp();

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Onboarding kon niet worden opgehaald: ${String(error)}`,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const toegestaan = await magSchrijven(req);

    if (!toegestaan) {
      return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
    }

    const body = await req.json();

    const email = String(body?.email || "").trim().toLowerCase();
    const instructieIds = Array.isArray(body?.instructieIds)
      ? body.instructieIds.map((id: unknown) => String(id))
      : [];

    if (!email) {
      return NextResponse.json(
        {
          success: false,
          error: "E-mailadres ontbreekt.",
        },
        { status: 400 }
      );
    }

    if (instructieIds.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Geen instructies geselecteerd.",
        },
        { status: 400 }
      );
    }

    let aantal = 0;

    for (const instructieId of instructieIds) {
      await db.query(
        `
        INSERT INTO gelezen_instructies (
          email,
          instructie_id,
          gelezen_op
        )
        VALUES ($1, $2, NOW())
        ON CONFLICT (email, instructie_id)
        DO UPDATE SET
          gelezen_op = COALESCE(gelezen_instructies.gelezen_op, NOW())
        `,
        [email, instructieId]
      );

      await db.query(
        `
        UPDATE onboarding_opdrachten
        SET
          status = 'afgerond',
          afgerond_op = COALESCE(afgerond_op, NOW()),
          bijgewerkt_op = NOW()
        WHERE LOWER(medewerker_email) = LOWER($1)
          AND instructie_id = $2
          AND status <> 'afgerond'
        `,
        [email, instructieId]
      );

      aantal += 1;
    }

    return NextResponse.json({
      success: true,
      aantal,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Onboarding kon niet worden bijgewerkt: ${String(error)}`,
      },
      { status: 500 }
    );
  }
}