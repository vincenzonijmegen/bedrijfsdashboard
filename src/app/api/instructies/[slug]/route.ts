import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";
import { db } from "@/lib/db";
import slugify from "slugify";

const geldigeFases = ["voor_eerste_shift", "binnen_2_weken", "taakgericht"];

const TOEGESTANE_LEESROLLEN = ["beheerder", "accountant"];
const TOEGESTANE_SCHRIJFROLLEN = ["beheerder"];

type RouteContext = {
  params: Promise<{
    slug: string;
  }>;
};

const normaliseerOnboardingFase = (fase: unknown) => {
  if (typeof fase !== "string") return "taakgericht";
  return geldigeFases.includes(fase) ? fase : "taakgericht";
};

const normaliseerVolgorde = (waarde: unknown) => {
  const nummer = Number(waarde);
  return Number.isFinite(nummer) ? nummer : 999;
};

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

function parseFuncties(functies: unknown) {
  if (Array.isArray(functies)) return functies;

  if (typeof functies === "string") {
    try {
      const parsed = JSON.parse(functies);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
}

export async function POST(req: NextRequest) {
  try {
    const toegestaan = await magSchrijven(req);

    if (!toegestaan) {
      return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
    }

    const {
      titel,
      inhoud,
      nummer,
      functies,
      onboarding_fase,
      onboarding_verplicht,
      onboarding_volgorde,
    } = await req.json();

    if (!titel?.trim()) {
      return NextResponse.json(
        { error: "Titel is verplicht" },
        { status: 400 }
      );
    }

    const slug = slugify(String(titel), { lower: true, strict: true });
    const created_at = new Date().toISOString();
    const functiesGeparsed = parseFuncties(functies);

    await db.query(
      `
        INSERT INTO instructies (
          titel,
          inhoud,
          slug,
          status,
          created_at,
          nummer,
          functies,
          onboarding_fase,
          onboarding_verplicht,
          onboarding_volgorde
        )
        VALUES ($1, $2, $3, 'concept', $4, $5, $6, $7, $8, $9)
      `,
      [
        titel,
        inhoud,
        slug,
        created_at,
        nummer,
        JSON.stringify(functiesGeparsed),
        normaliseerOnboardingFase(onboarding_fase),
        Boolean(onboarding_verplicht),
        normaliseerVolgorde(onboarding_volgorde),
      ]
    );

    return NextResponse.json({ slug }, { status: 200 });
  } catch (err) {
    console.error("🛑 Fout bij POST /api/instructies/[slug]:", err);

    return NextResponse.json(
      { error: "Fout bij opslaan" },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const toegestaan = await magLezen(req);

    if (!toegestaan) {
      return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
    }

    const { slug } = await context.params;

    const result = await db.query(
      `
        SELECT
          id,
          titel,
          inhoud,
          nummer,
          functies,
          COALESCE(onboarding_fase, 'taakgericht') AS onboarding_fase,
          COALESCE(onboarding_verplicht, false) AS onboarding_verplicht,
          COALESCE(onboarding_volgorde, 999) AS onboarding_volgorde
        FROM instructies
        WHERE slug = $1
        LIMIT 1
      `,
      [slug]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
    }

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (err) {
    console.error("🛑 Fout bij GET /api/instructies/[slug]:", err);

    return NextResponse.json(
      { error: "Ophalen mislukt" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const toegestaan = await magSchrijven(req);

    if (!toegestaan) {
      return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
    }

    const { slug } = await context.params;

    const {
      titel,
      inhoud,
      nummer,
      functies,
      onboarding_fase,
      onboarding_verplicht,
      onboarding_volgorde,
    } = await req.json();

    if (!titel?.trim()) {
      return NextResponse.json(
        { error: "Titel is verplicht" },
        { status: 400 }
      );
    }

    const functiesGeparsed = parseFuncties(functies);

    await db.query(
      `
        UPDATE instructies
        SET
          titel = $1,
          inhoud = $2,
          nummer = $3,
          functies = $4,
          onboarding_fase = $5,
          onboarding_verplicht = $6,
          onboarding_volgorde = $7
        WHERE slug = $8
      `,
      [
        titel,
        inhoud,
        nummer,
        JSON.stringify(functiesGeparsed),
        normaliseerOnboardingFase(onboarding_fase),
        Boolean(onboarding_verplicht),
        normaliseerVolgorde(onboarding_volgorde),
        slug,
      ]
    );

    return NextResponse.json({ slug }, { status: 200 });
  } catch (err) {
    console.error("🛑 Fout bij PUT /api/instructies/[slug]:", err);

    return NextResponse.json(
      { error: "Update mislukt" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const toegestaan = await magSchrijven(req);

    if (!toegestaan) {
      return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
    }

    const { slug } = await context.params;

    await db.query("DELETE FROM instructies WHERE slug = $1", [slug]);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("🛑 Fout bij DELETE /api/instructies/[slug]:", err);

    return NextResponse.json(
      { error: "Verwijderen mislukt" },
      { status: 500 }
    );
  }
}