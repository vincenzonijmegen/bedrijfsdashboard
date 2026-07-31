// src/app/api/leveranciers/route.ts

import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

const geldigeSoorten = ["wekelijks", "incidenteel"];

function valideerSoort(soort: unknown) {
  return typeof soort === "string" && geldigeSoorten.includes(soort);
}

// GET: alle leveranciers ophalen
export async function GET() {
  try {
    const res = await db.query(
      `SELECT id, naam, soort
       FROM leveranciers
       ORDER BY naam`
    );

    return NextResponse.json(res.rows);
  } catch (err) {
    console.error("Fout bij ophalen leveranciers:", err);

    return NextResponse.json(
      { error: "Databasefout" },
      { status: 500 }
    );
  }
}

// POST: nieuwe leverancier toevoegen
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const naam =
      typeof body?.naam === "string"
        ? body.naam.trim()
        : "";

    const soort = body?.soort;

    if (!naam) {
      return NextResponse.json(
        { error: "Naam is verplicht" },
        { status: 400 }
      );
    }

    if (!valideerSoort(soort)) {
      return NextResponse.json(
        { error: "Soort moet 'wekelijks' of 'incidenteel' zijn" },
        { status: 400 }
      );
    }

    const result = await db.query(
      `INSERT INTO leveranciers (naam, soort)
       VALUES ($1, $2)
       RETURNING id, naam, soort`,
      [naam, soort]
    );

    return NextResponse.json(result.rows[0], { status: 201 });
  } catch (err: any) {
    if (err?.code === "23505") {
      return NextResponse.json(
        { error: "Deze leverancier bestaat al" },
        { status: 409 }
      );
    }

    console.error("Fout bij toevoegen leverancier:", err);

    return NextResponse.json(
      { error: "Toevoegen mislukt" },
      { status: 500 }
    );
  }
}

// PUT: bestaande leverancier bijwerken
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));

    const id = Number(body?.id);
    const naam =
      typeof body?.naam === "string"
        ? body.naam.trim()
        : "";

    const soort = body?.soort;

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json(
        { error: "Geldig ID is verplicht" },
        { status: 400 }
      );
    }

    if (!naam) {
      return NextResponse.json(
        { error: "Naam is verplicht" },
        { status: 400 }
      );
    }

    if (!valideerSoort(soort)) {
      return NextResponse.json(
        { error: "Soort moet 'wekelijks' of 'incidenteel' zijn" },
        { status: 400 }
      );
    }

    const result = await db.query(
      `UPDATE leveranciers
       SET naam = $1,
           soort = $2
       WHERE id = $3
       RETURNING id, naam, soort`,
      [naam, soort, id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Leverancier niet gevonden" },
        { status: 404 }
      );
    }

    return NextResponse.json(result.rows[0]);
  } catch (err: any) {
    if (err?.code === "23505") {
      return NextResponse.json(
        { error: "Deze leverancier bestaat al" },
        { status: 409 }
      );
    }

    console.error("Fout bij bijwerken leverancier:", err);

    return NextResponse.json(
      { error: "Update mislukt" },
      { status: 500 }
    );
  }
}

// DELETE: leverancier verwijderen
export async function DELETE(req: NextRequest) {
  try {
    const id = Number(req.nextUrl.searchParams.get("id"));

    if (!Number.isFinite(id) || id <= 0) {
      return NextResponse.json(
        { error: "Geldig ID ontbreekt" },
        { status: 400 }
      );
    }

    const result = await db.query(
      `DELETE FROM leveranciers
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Leverancier niet gevonden" },
        { status: 404 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err?.code === "23503") {
      return NextResponse.json(
        {
          error:
            "Deze leverancier kan niet worden verwijderd omdat er nog artikelen of bestellingen aan gekoppeld zijn.",
        },
        { status: 409 }
      );
    }

    console.error("Fout bij verwijderen leverancier:", err);

    return NextResponse.json(
      { error: "Verwijderen mislukt" },
      { status: 500 }
    );
  }
}