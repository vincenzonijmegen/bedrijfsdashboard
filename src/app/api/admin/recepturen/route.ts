import { NextRequest, NextResponse } from "next/server";
import { getClient } from "@/lib/db";

type IngredientInput = {
  naam: string;
  gewicht: string;
};

export async function POST(req: NextRequest) {
  const client = await getClient();

  try {
    const body = await req.json();

    const naam = String(body?.naam || "").trim();
    const maakvolgorde = Number(body?.maakvolgorde ?? 50);
    const categorie = String(body?.categorie || "").trim();
    const hoeveelheid_mix = String(body?.hoeveelheid_mix || "").trim();
    const maakinstructie = String(body?.maakinstructie || "").trim();
    const actief = body?.actief !== false;

    const ingredientenRaw = Array.isArray(body?.ingredienten)
      ? body.ingredienten
      : [];

    const ingredienten: IngredientInput[] = ingredientenRaw
      .map((ing: any) => ({
        naam: String(ing?.naam || "").trim(),
        gewicht: String(ing?.gewicht || "").trim(),
      }))
      .filter((ing: IngredientInput) => ing.naam && ing.gewicht);

    if (!naam) {
      return NextResponse.json(
        { success: false, error: "Naam ontbreekt" },
        { status: 400 }
      );
    }

    if (!categorie) {
      return NextResponse.json(
        { success: false, error: "Categorie ontbreekt" },
        { status: 400 }
      );
    }

    await client.query("BEGIN");

    const receptResult = await client.query<{
      id: number;
    }>(
      `
INSERT INTO keuken_recepten (
  categorie,
  naam,
  hoeveelheid_mix,
  maakinstructie,
  actief,
  maakvolgorde
)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id
      `,
[
  categorie,
  naam,
  hoeveelheid_mix || null,
  maakinstructie || null,
  actief,
  maakvolgorde,
]
    );

    const receptId = receptResult.rows[0].id;

    for (let i = 0; i < ingredienten.length; i++) {
      const ing = ingredienten[i];

      await client.query(
        `
        INSERT INTO keuken_recept_ingredienten (
          recept_id,
          naam,
          gewicht,
          volgorde
        )
        VALUES ($1, $2, $3, $4)
        `,
        [receptId, ing.naam, ing.gewicht, i + 1]
      );
    }

    await client.query("COMMIT");

    return NextResponse.json({
      success: true,
      id: receptId,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("POST /api/admin/recepturen fout:", error);

    return NextResponse.json(
      { success: false, error: "Opslaan van recept mislukt" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}