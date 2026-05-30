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

    return new NextResponse(JSON.stringify({ slug }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("🛑 Fout bij POST:", err);
    return NextResponse.json({ error: "Fout bij opslaan" }, { status: 500 });
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