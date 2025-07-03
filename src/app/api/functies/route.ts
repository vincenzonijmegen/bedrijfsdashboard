// src/app/api/functies/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const result = await db.query("SELECT * FROM functies ORDER BY naam");
    return NextResponse.json(result.rows);
  } } catch (error) {
    console.error("Fout bij ophalen functies:", error);
    return NextResponse.json({ error: "Fout bij ophalen" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, naam, omschrijving } = body;

    if (!id) {
      return NextResponse.json({ error: "ID ontbreekt" }, { status: 400 });
    }

    await db.query(
      "UPDATE functies SET omschrijving = $1 WHERE id = $2",
      [omschrijving || "", id]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Fout bij bijwerken functie:", error);
    return NextResponse.json({ error: "Fout bij bijwerken" }, { status: 500 });
  }
}
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { naam, omschrijving } = body;

    if (!naam) {
      return NextResponse.json({ error: "Naam is verplicht" }, { status: 400 });
    }

    await db.query(
      "INSERT INTO functies (naam, omschrijving) VALUES ($1, $2)",
      [naam, omschrijving || ""]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Fout bij toevoegen functie:", error);
    return NextResponse.json({ error: "Fout bij toevoegen" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID ontbreekt" }, { status: 400 });
    }

    // Check of functie nog gekoppeld is aan medewerkers
    const check = await db.query("SELECT COUNT(*) FROM medewerkers WHERE functie = (SELECT naam FROM functies WHERE id = $1)", [id]);
    const count = Number(check.rows[0].count);

    if (count > 0) {
      return NextResponse.json({ error: "Functie is nog gekoppeld aan medewerkers" }, { status: 400 });
    }

    await db.query("DELETE FROM functies WHERE id = $1", [id]);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Fout bij verwijderen functie:", error);
    return NextResponse.json({ error: "Fout bij verwijderen" }, { status: 500 });
  }
}
