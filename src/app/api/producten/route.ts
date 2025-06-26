// src/app/api/producten/route.ts

import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const {
      id, // toegevoegd voor bewerken
      leverancier_id,
      nieuwe_leverancier,
      naam,
      bestelnummer,
      minimum_voorraad,
      besteleenheid,
      prijs,
      actief,
      volgorde,
    } = data;

    let lid = leverancier_id;

    if (!lid && nieuwe_leverancier) {
      const result = await db.query(
        `INSERT INTO leveranciers (naam)
         VALUES ($1)
         ON CONFLICT (naam) DO UPDATE SET naam = EXCLUDED.naam
         RETURNING id`,
        [nieuwe_leverancier]
      );
      lid = result.rows[0].id;
    }

    if (!lid || !naam) {
      return NextResponse.json({ error: "leverancier en naam verplicht" }, { status: 400 });
    }

    let pid = id;
    let vorigePrijs = null;

    if (id) {
      const check = await db.query(
        `SELECT huidige_prijs FROM producten WHERE id = $1`,
        [id]
      );
      vorigePrijs = check.rows[0]?.huidige_prijs ?? null;

      await db.query(
        `UPDATE producten
         SET leverancier_id = $1, naam = $2, bestelnummer = $3, minimum_voorraad = $4,
             besteleenheid = $5, huidige_prijs = $6, actief = $7, volgorde = $8
         WHERE id = $9`,
        [lid, naam, bestelnummer ?? null, minimum_voorraad ?? null, besteleenheid ?? 1, prijs ?? null, actief ?? true, volgorde ?? null, id]
      );
    } else {
      const insert = await db.query(
        `INSERT INTO producten
         (leverancier_id, naam, bestelnummer, minimum_voorraad, besteleenheid, actief, huidige_prijs, volgorde)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [lid, naam, bestelnummer ?? null, minimum_voorraad ?? null, besteleenheid ?? 1, actief ?? true, prijs ?? null, volgorde ?? null]
      );
      pid = insert.rows[0].id;
    }

    if (prijs != null && prijs !== vorigePrijs) {
      await db.query(
        `INSERT INTO productprijzen (product_id, prijs) VALUES ($1, $2)`,
        [pid, prijs]
      );
    }

    return NextResponse.json({ status: "ok", id: pid });
  } catch (err) {
    console.error("Fout bij opslaan product:", err);
    return NextResponse.json({ error: "Serverfout" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leverancierId = searchParams.get("leverancier");

  if (!leverancierId) {
    return NextResponse.json({ error: "leverancier vereist" }, { status: 400 });
  }

  try {
    const result = await db.query(
      `SELECT id, naam, bestelnummer, minimum_voorraad, besteleenheid, huidige_prijs, actief, volgorde
       FROM producten
       WHERE leverancier_id = $1
       ORDER BY volgorde NULLS LAST, naam`,
      [leverancierId]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("Fout bij ophalen producten:", err);
    return NextResponse.json({ error: "Serverfout" }, { status: 500 });
  }
}
