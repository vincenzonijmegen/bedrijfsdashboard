import { NextRequest, NextResponse } from "next/server";
import { getClient, query } from "@/lib/db";

type IngredientInput = {
  naam: string;
  gewicht: string;
};

type ReceptRow = {
  id: number;
  categorie: string;
  naam: string;
  hoeveelheid_mix: string | null;
  maakinstructie: string | null;
  actief: boolean;
  maakvolgorde: number; // 👈 toevoegen
};

type IngredientRow = {
  naam: string;
  gewicht: string;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const receptResult = await query<ReceptRow>(
      `
      SELECT
  id,
  categorie,
  naam,
  hoeveelheid_mix,
  maakinstructie,
  actief,
  maakvolgorde
FROM keuken_recepten
WHERE id = $1
LIMIT 1
      `,
      [id]
    );

    const recept = receptResult.rows[0];

    if (!recept) {
      return NextResponse.json(
        { success: false, error: "Recept niet gevonden" },
        { status: 404 }
      );
    }

    const ingredientenResult = await query<IngredientRow>(
      `
      SELECT naam, gewicht
      FROM keuken_recept_ingredienten
      WHERE recept_id = $1
      ORDER BY volgorde ASC
      `,
      [id]
    );

    return NextResponse.json({
      success: true,
      recept: {
        ...recept,
        ingredienten: ingredientenResult.rows,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/recepturen/[id] fout:", error);
    return NextResponse.json(
      { success: false, error: "Fout bij ophalen recept" },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const client = await getClient();

  try {
    const { id } = await params;
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

    const updateResult = await client.query(
  `
  UPDATE keuken_recepten
  SET
    categorie = $1,
    naam = $2,
    hoeveelheid_mix = $3,
    maakinstructie = $4,
    actief = $5,
    maakvolgorde = $6,
    updated_at = now()
  WHERE id = $7
  `,
  [
    categorie,
    naam,
    hoeveelheid_mix || null,
    maakinstructie || null,
    actief,
    maakvolgorde,
    id,
  ]
);

    if (updateResult.rowCount === 0) {
      await client.query("ROLLBACK");
      return NextResponse.json(
        { success: false, error: "Recept niet gevonden" },
        { status: 404 }
      );
    }

    await client.query(
      `DELETE FROM keuken_recept_ingredienten WHERE recept_id = $1`,
      [id]
    );

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
        [id, ing.naam, ing.gewicht, i + 1]
      );
    }

    await client.query("COMMIT");

    return NextResponse.json({ success: true });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("PUT /api/admin/recepturen/[id] fout:", error);

    return NextResponse.json(
      { success: false, error: "Bijwerken van recept mislukt" },
      { status: 500 }
    );
  } finally {
    client.release();
  }
}