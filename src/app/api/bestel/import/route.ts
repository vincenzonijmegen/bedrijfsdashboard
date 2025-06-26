// src/app/api/bestel/import/route.ts

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as xlsx from "xlsx";

export async function POST(req: Request) {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  if (!file) return NextResponse.json({ error: "Geen bestand ontvangen" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = xlsx.read(buffer, { type: "buffer" });

  const leveranciersSheet = wb.Sheets["Leveranciers"];
  const productenSheet = wb.Sheets["Producten"];

  if (!leveranciersSheet || !productenSheet) {
    return NextResponse.json({ error: "Beide tabbladen 'Leveranciers' en 'Producten' zijn verplicht" }, { status: 400 });
  }

  const leveranciers = xlsx.utils.sheet_to_json(leveranciersSheet);
  const producten = xlsx.utils.sheet_to_json(productenSheet);

  const leverancierIds: Record<string, number> = {};

  for (const l of leveranciers) {
    const { naam, whatsapp, email } = l as any;
    if (!naam) continue;
    const result = await db.query(
      `INSERT INTO leveranciers (naam, whatsapp, email)
       VALUES ($1, $2, $3)
       ON CONFLICT (naam) DO UPDATE SET whatsapp = EXCLUDED.whatsapp, email = EXCLUDED.email
       RETURNING id`,
      [naam, whatsapp ?? null, email ?? null]
    );
    leverancierIds[naam.trim()] = result.rows[0].id;
  }

  for (const p of producten) {
    const { leverancier, naam, bestelnummer, min_voorraad, besteleenheid, prijs } = p as any;
    if (!leverancier || !naam) continue;
    const lid = leverancierIds[leverancier.trim()];
    if (!lid) continue;

    const result = await db.query(
      `INSERT INTO producten (leverancier_id, naam, bestelnummer, minimum_voorraad, besteleenheid, actief, huidige_prijs)
       VALUES ($1, $2, $3, $4, $5, TRUE, $6)
       ON CONFLICT (leverancier_id, naam)
       DO UPDATE SET bestelnummer = EXCLUDED.bestelnummer, minimum_voorraad = EXCLUDED.minimum_voorraad, besteleenheid = EXCLUDED.besteleenheid, huidige_prijs = EXCLUDED.huidige_prijs
       RETURNING id, huidige_prijs`,
      [lid, naam, bestelnummer ?? null, min_voorraad ?? null, besteleenheid ?? 1, prijs ?? null]
    );

    // optioneel prijslog
    if (prijs && result.rows[0]?.huidige_prijs !== priceAsFloat(price)) {
      await db.query(
        `INSERT INTO productprijzen (product_id, prijs)
         VALUES ($1, $2)`,
        [result.rows[0].id, priceAsFloat(price)]
      );
    }
  }

  return NextResponse.json({ status: "ok" });
}

function priceAsFloat(p: any): number {
  const f = parseFloat(p);
  return isNaN(f) ? 0 : Number(f.toFixed(2));
}
