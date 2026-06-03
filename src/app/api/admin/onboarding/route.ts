// src/app/api/admin/onboarding/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OnboardingFase = "voor_eerste_shift" | "binnen_2_weken" | "taakgericht";

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

  if (medewerker.functie) {
    functies.add(String(medewerker.functie));
  }

  if (medewerker.kan_scheppen) {
    functies.add("scheppers overdag");
    functies.add("scheppers overdag + avond");
  }

  if (medewerker.kan_voorbereiden) {
    functies.add("ijsvoorbereiders");
  }

  if (medewerker.kan_ijsbereiden) {
    functies.add("keukenmedewerkers");
  }

  return Array.from(functies);
}

function instructieHoortBijMedewerker(instructie: any, functiesMedewerker: string[]) {
  const functiesInstructie = normalizeFuncties(instructie.functies);

  if (functiesInstructie.length === 0) {
    return false;
  }

  return functiesInstructie.some((functie) => functiesMedewerker.includes(functie));
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
      email,
      instructie_id,
      gelezen_op
    FROM gelezen_instructies
  `);

  const gelezenSet = new Set(
    gelezenResult.rows.map(
      (row) => `${String(row.email).toLowerCase()}::${String(row.instructie_id)}`
    )
  );

  const items = medewerkersResult.rows.map((medewerker) => {
    const functies = medewerkerFuncties(medewerker);

    const verplichteInstructies = instructiesResult.rows
      .filter((instructie) => instructieHoortBijMedewerker(instructie, functies))
      .map((instructie) => {
        const gelezen = gelezenSet.has(
          `${String(medewerker.email).toLowerCase()}::${String(instructie.id)}`
        );

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
        };
      })
      .sort((a, b) => {
        const fase = faseVolgorde(a.onboarding_fase) - faseVolgorde(b.onboarding_fase);
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
        afgerond: totaal > 0 && open === 0,
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

export async function GET() {
  try {
    const data = await haalOnboardingDataOp();

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("Fout bij ophalen onboarding:", error);

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
    const body = await req.json();

    const email = String(body?.email || "").trim().toLowerCase();
    const instructieIds = Array.isArray(body?.instructieIds)
      ? body.instructieIds.map(Number).filter((id: number) => Number.isInteger(id))
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
          error: "Geen instructies ontvangen om af te vinken.",
        },
        { status: 400 }
      );
    }

    await db.query(
      `
      INSERT INTO gelezen_instructies (email, instructie_id, gelezen_op)
      SELECT $1, unnest($2::int[]), NOW()
      ON CONFLICT (email, instructie_id)
      DO UPDATE SET gelezen_op = COALESCE(gelezen_instructies.gelezen_op, NOW())
      `,
      [email, instructieIds]
    );

    return NextResponse.json({
      success: true,
      email,
      aantal: instructieIds.length,
    });
  } catch (error) {
    console.error("Fout bij afvinken onboarding:", error);

    return NextResponse.json(
      {
        success: false,
        error: `Onboarding kon niet worden afgevinkt: ${String(error)}`,
      },
      { status: 500 }
    );
  }
}