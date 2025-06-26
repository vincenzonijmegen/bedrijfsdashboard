// src/app/api/producten/route.ts

import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const data = await req.json();
    const {
      leverancier_id,
      nieuwe_leverancier,
      naam,
      bestelnummer,
      minimum_voorraad,
      besteleenheid,
      prijs,
      actief,
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

    const check = await db.query(
      `SELECT id, huidige_prijs FROM producten WHERE leverancier_id = $1 AND LOWER(naam) = LOWER($2)`,
      [lid, naam]
    );

    let pid;
    if (check.rows.length > 0) {
      pid = check.rows[0].id;
      await db.query(
        `UPDATE producten
         SET bestelnummer = $1, minimum_voorraad = $2, besteleenheid = $3, huidige_prijs = $4, actief = $5
         WHERE id = $6`,
        [bestelnummer ?? null, minimum_voorraad ?? null, besteleenheid ?? 1, prijs ?? null, actief ?? true, pid]
      );
    } else {
      const insert = await db.query(
        `INSERT INTO producten
         (leverancier_id, naam, bestelnummer, minimum_voorraad, besteleenheid, actief, huidige_prijs)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [lid, naam, bestelnummer ?? null, minimum_voorraad ?? null, besteleenheid ?? 1, actief ?? true, prijs ?? null]
      );
      pid = insert.rows[0].id;
    }

    if (prijs && check.rows[0]?.huidige_prijs !== prijs) {
      await db.query(
        `INSERT INTO productprijzen (product_id, prijs) VALUES ($1, $2)`,
        [pid, prijs]
      );
    }

    return NextResponse.json({ status: "ok", id: pid });
  } catch (err) {
    console.error("Fout bij toevoegen product:", err);
    return NextResponse.json({ error: "Serverfout" }, { status: 500 });
  }
}
