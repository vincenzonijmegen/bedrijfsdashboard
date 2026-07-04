import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyJWT } from "@/lib/auth";
import slugify from "slugify";

const geldigeFases = ["voor_eerste_shift", "binnen_2_weken", "taakgericht"];

const TOEGESTANE_LEESROLLEN = [
  "beheerder",
  "accountant",
  "medewerker",
  "keuken",
  "winkel",
];
const TOEGESTANE_SCHRIJFROLLEN = ["beheerder"];

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

    if (!titel || !inhoud) {
      return NextResponse.json(
        { error: "Titel en inhoud zijn verplicht." },
        { status: 400 }
      );
    }

    const slug = slugify(String(titel), { lower: true, strict: true });
    const created_at = new Date().toISOString();

    const functiesGeparsed = Array.isArray(functies)
      ? functies
      : typeof functies === "string"
      ? (() => {
          try {
            const parsed = JSON.parse(functies);
            return Array.isArray(parsed) ? parsed : [];
          } catch {
            return [];
          }
        })()
      : [];

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
        VALUES ($1, $2, $3, 'actief', $4, $5, $6, $7, $8, $9)
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
    console.error("🛑 Fout bij POST /api/instructies:", err);

    return NextResponse.json(
      { error: "Fout bij opslaan" },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const result = await db.query(`
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
      ORDER BY
        onboarding_volgorde ASC,
        nummer ASC NULLS LAST,
        created_at DESC
    `);

    return NextResponse.json(result.rows, { status: 200 });
  } catch (err) {
    console.error("🛑 Fout bij GET /api/instructies:", err);

    return NextResponse.json(
      { error: "Fout bij ophalen" },
      { status: 500 }
    );
  }
}