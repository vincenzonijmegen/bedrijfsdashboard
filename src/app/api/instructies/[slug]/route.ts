import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import slugify from "slugify";

const geldigeFases = ["voor_eerste_shift", "binnen_2_weken", "taakgericht"];

const normaliseerOnboardingFase = (fase: unknown) => {
  if (typeof fase !== "string") return "taakgericht";
  return geldigeFases.includes(fase) ? fase : "taakgericht";
};

const normaliseerVolgorde = (waarde: unknown) => {
  const nummer = Number(waarde);
  return Number.isFinite(nummer) ? nummer : 999;
};

export async function POST(req: Request) {
  try {
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
      return NextResponse.json({ error: "Titel is verplicht" }, { status: 400 });
    }

    const slug = slugify(titel, { lower: true, strict: true });
    const created_at = new Date().toISOString();

    const functiesGeparsed = Array.isArray(functies)
      ? functies
      : typeof functies === "string"
      ? (() => {
          try {
            return JSON.parse(functies);
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

    return new NextResponse(JSON.stringify({ slug }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("🛑 Fout bij POST:", err);
    return NextResponse.json({ error: "Fout bij opslaan" }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function GET(req: Request, context: any) {
  const slug = context?.params?.slug;

  if (slug) {
    try {
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
        `,
        [Array.isArray(slug) ? slug[0] : slug]
      );

      if (result.rows.length === 0) {
        return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
      }

      return NextResponse.json(result.rows[0], { status: 200 });
    } catch (err) {
      console.error("🛑 Fout bij GET (één instructie):", err);
      return NextResponse.json({ error: "Ophalen mislukt" }, { status: 500 });
    }
  }

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
      ORDER BY
        onboarding_volgorde ASC,
        nummer ASC NULLS LAST,
        created_at DESC
    `);

    return NextResponse.json(result.rows, { status: 200 });
  } catch (err) {
    console.error("🛑 Fout bij ophalen instructies:", err);
    return NextResponse.json({ error: "Fout bij ophalen" }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function PUT(req: Request, context: any) {
  const slug = Array.isArray(context.params.slug)
    ? context.params.slug[0]
    : context.params.slug;

  try {
    const {
      titel,
      inhoud,
      nummer,
      functies,
      onboarding_fase,
      onboarding_verplicht,
      onboarding_volgorde,
    } = await req.json();

    const functiesGeparsed = Array.isArray(functies)
      ? functies
      : typeof functies === "string"
      ? (() => {
          try {
            return JSON.parse(functies);
          } catch {
            return [];
          }
        })()
      : [];

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
    console.error("🛑 Fout bij PUT:", err);
    return NextResponse.json({ error: "Update mislukt" }, { status: 500 });
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function DELETE(_req: Request, context: any) {
  const slug = Array.isArray(context.params.slug)
    ? context.params.slug[0]
    : context.params.slug;

  try {
    await db.query("DELETE FROM instructies WHERE slug = $1", [slug]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("🛑 Fout bij DELETE:", err);
    return NextResponse.json({ error: "Verwijderen mislukt" }, { status: 500 });
  }
}