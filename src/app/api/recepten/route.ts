// src/app/api/recepten/route.ts

import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const recepten = await db.query(`
      SELECT r.*, p.naam as product_naam
      FROM recepten r
      LEFT JOIN producten p ON r.product_id = p.id
      ORDER BY r.naam`);

    const regels = await db.query(`
      SELECT rr.*, pr.naam as product_naam
      FROM recept_regels rr
      JOIN producten pr ON rr.product_id = pr.id`);

    const response = recepten.rows.map((r) => ({
      ...r,
      regels: regels.rows.filter((rr) => rr.recept_id === r.id),
    }));

    return NextResponse.json(response);
  } catch (err) {
    console.error("Fout bij ophalen recepten:", err);
    return NextResponse.json({ error: "Serverfout" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, naam, omschrijving, totaal_output, eenheid, product_id, regels } = body;

    let receptId = id;

    if (id) {
      await db.query(
        `UPDATE recepten SET naam = $1, omschrijving = $2, totaal_output = $3, eenheid = $4, product_id = $5 WHERE id = $6`,
        [naam, omschrijving, totaal_output, eenheid, product_id, id]
      );
      await db.query(`DELETE FROM recept_regels WHERE recept_id = $1`, [id]);
    } else {
      const insert = await db.query(
        `INSERT INTO recepten (naam, omschrijving, totaal_output, eenheid, product_id)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [naam, omschrijving, totaal_output, eenheid, product_id]
      );
      receptId = insert.rows[0].id;
    }

    for (const regel of regels) {
      await db.query(
        `INSERT INTO recept_regels (recept_id, product_id, hoeveelheid, eenheid)
         VALUES ($1, $2, $3, $4)`,
        [receptId, regel.product_id, regel.hoeveelheid, regel.eenheid]
      );
    }

    return NextResponse.json({ status: "ok", id: receptId });
  } catch (err) {
    console.error("Fout bij opslaan recept:", err);
    return NextResponse.json({ error: "Serverfout" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "id ontbreekt" }, { status: 400 });
  }

  try {
    await db.query(`DELETE FROM recept_regels WHERE recept_id = $1`, [id]);
    await db.query(`DELETE FROM recepten WHERE id = $1`, [id]);
    return NextResponse.json({ status: "verwijderd" });
  } catch (err) {
    console.error("Fout bij verwijderen recept:", err);
    return NextResponse.json({ error: "Serverfout" }, { status: 500 });
  }
}
