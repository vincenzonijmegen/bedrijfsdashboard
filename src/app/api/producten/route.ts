// src/app/api/producten/route.ts

import { db } from "@/lib/db";
import { NextResponse } from "next/server";

function foutmelding(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

function leesOptioneelGetal(waarde: unknown) {
  if (waarde === undefined || waarde === null || waarde === "") {
    return null;
  }

  const nummer = Number(waarde);
  return Number.isFinite(nummer) ? nummer : NaN;
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));

  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json(
      { error: "Geldig product-ID ontbreekt" },
      { status: 400 }
    );
  }

  try {
    const result = await db.query(
      `DELETE FROM producten
       WHERE id = $1
       RETURNING id`,
      [id]
    );

    if (result.rowCount === 0) {
      return NextResponse.json(
        { error: "Product niet gevonden" },
        { status: 404 }
      );
    }

    return NextResponse.json({ status: "verwijderd" });
  } catch (err: any) {
    if (err?.code === "23503") {
      return NextResponse.json(
        {
          error:
            "Dit product kan niet worden verwijderd omdat het nog ergens wordt gebruikt. Zet het product eventueel op inactief.",
        },
        { status: 409 }
      );
    }

    console.error("Fout bij verwijderen product:", err);

    return NextResponse.json(
      { error: "Serverfout bij verwijderen product" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const data = await req.json().catch(() => ({}));

    const {
      id,
      leverancier_id,
      nieuwe_leverancier,
      naam,
      bestelnummer,
      minimum_voorraad,
      besteleenheid,
      prijs,
      inhoud,
      eenheid,
      is_samengesteld,
      actief,
      volgorde,
    } = data;

    const productId =
      id === undefined || id === null || id === "" ? null : Number(id);

    if (
      productId !== null &&
      (!Number.isInteger(productId) || productId <= 0)
    ) {
      return NextResponse.json(
        { error: "Ongeldig product-ID" },
        { status: 400 }
      );
    }

    const productNaam =
      typeof naam === "string" ? naam.trim() : "";

    if (!productNaam) {
      return NextResponse.json(
        { error: "Productnaam is verplicht" },
        { status: 400 }
      );
    }

    const minimumVoorraad = leesOptioneelGetal(minimum_voorraad);
    const bestelEenheid =
      besteleenheid === undefined || besteleenheid === null
        ? 1
        : Number(besteleenheid);
    const productPrijs = leesOptioneelGetal(prijs);
    const productInhoud = leesOptioneelGetal(inhoud);
    const productVolgorde = leesOptioneelGetal(volgorde);

    if (
      Number.isNaN(minimumVoorraad) ||
      (minimumVoorraad !== null && minimumVoorraad < 0)
    ) {
      return NextResponse.json(
        { error: "Minimumvoorraad moet 0 of hoger zijn" },
        { status: 400 }
      );
    }

    if (!Number.isFinite(bestelEenheid) || bestelEenheid <= 0) {
      return NextResponse.json(
        { error: "Besteleenheid moet groter zijn dan 0" },
        { status: 400 }
      );
    }

    if (
      Number.isNaN(productPrijs) ||
      (productPrijs !== null && productPrijs < 0)
    ) {
      return NextResponse.json(
        { error: "Prijs moet 0 of hoger zijn" },
        { status: 400 }
      );
    }

    if (
      Number.isNaN(productInhoud) ||
      (productInhoud !== null && productInhoud < 0)
    ) {
      return NextResponse.json(
        { error: "Inhoud moet 0 of hoger zijn" },
        { status: 400 }
      );
    }

    if (
      Number.isNaN(productVolgorde) ||
      (productVolgorde !== null && !Number.isInteger(productVolgorde))
    ) {
      return NextResponse.json(
        { error: "Volgorde moet een geheel getal zijn" },
        { status: 400 }
      );
    }

    const leverancierId =
      leverancier_id === undefined ||
      leverancier_id === null ||
      leverancier_id === ""
        ? null
        : Number(leverancier_id);

    const nieuweLeverancier =
      typeof nieuwe_leverancier === "string"
        ? nieuwe_leverancier.trim()
        : "";

    let lid = leverancierId;

    if (
      lid !== null &&
      (!Number.isInteger(lid) || lid <= 0)
    ) {
      return NextResponse.json(
        { error: "Ongeldige leverancier" },
        { status: 400 }
      );
    }

    if (!lid && nieuweLeverancier) {
      const result = await db.query(
        `INSERT INTO leveranciers (naam)
         VALUES ($1)
         ON CONFLICT (naam)
         DO UPDATE SET naam = EXCLUDED.naam
         RETURNING id`,
        [nieuweLeverancier]
      );

      lid = result.rows[0].id;
    }

    if (!lid) {
      return NextResponse.json(
        { error: "Leverancier is verplicht" },
        { status: 400 }
      );
    }

    let pid = productId;
    let vorigePrijs: number | null = null;
    let nieuwePrijs = productPrijs;

    if (productId) {
      const check = await db.query(
        `SELECT huidige_prijs
         FROM producten
         WHERE id = $1`,
        [productId]
      );

      if (check.rowCount === 0) {
        return NextResponse.json(
          { error: "Product niet gevonden" },
          { status: 404 }
        );
      }

      vorigePrijs = check.rows[0]?.huidige_prijs ?? null;

      if (prijs === undefined) {
        nieuwePrijs = vorigePrijs;
      }

      const update = await db.query(
        `UPDATE producten
         SET leverancier_id = $1,
             naam = $2,
             bestelnummer = $3,
             minimum_voorraad = $4,
             besteleenheid = $5,
             huidige_prijs = $6,
             inhoud = $7,
             eenheid = $8,
             is_samengesteld = $9,
             actief = $10,
             volgorde = $11
         WHERE id = $12
         RETURNING id`,
        [
          lid,
          productNaam,
          typeof bestelnummer === "string"
            ? bestelnummer.trim() || null
            : null,
          minimumVoorraad,
          bestelEenheid,
          nieuwePrijs,
          productInhoud,
          typeof eenheid === "string" ? eenheid : null,
          Boolean(is_samengesteld),
          actief === undefined ? true : Boolean(actief),
          productVolgorde,
          productId,
        ]
      );

      if (update.rowCount === 0) {
        return NextResponse.json(
          { error: "Product niet gevonden" },
          { status: 404 }
        );
      }
    } else {
      const insert = await db.query(
        `INSERT INTO producten
         (
           leverancier_id,
           naam,
           bestelnummer,
           minimum_voorraad,
           besteleenheid,
           huidige_prijs,
           inhoud,
           eenheid,
           is_samengesteld,
           actief,
           volgorde
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id`,
        [
          lid,
          productNaam,
          typeof bestelnummer === "string"
            ? bestelnummer.trim() || null
            : null,
          minimumVoorraad,
          bestelEenheid,
          Boolean(is_samengesteld) ? null : productPrijs,
          productInhoud,
          typeof eenheid === "string" ? eenheid : null,
          Boolean(is_samengesteld),
          actief === undefined ? true : Boolean(actief),
          productVolgorde,
        ]
      );

      pid = insert.rows[0].id;
      nieuwePrijs = Boolean(is_samengesteld) ? null : productPrijs;
    }

    if (
      pid &&
      nieuwePrijs !== null &&
      Number(nieuwePrijs) !== Number(vorigePrijs)
    ) {
      await db.query(
        `INSERT INTO productprijzen (product_id, prijs)
         VALUES ($1, $2)`,
        [pid, nieuwePrijs]
      );
    }

    return NextResponse.json({ status: "ok", id: pid });
  } catch (err: any) {
    if (err?.code === "23503") {
      return NextResponse.json(
        { error: "De gekozen leverancier bestaat niet" },
        { status: 400 }
      );
    }

    if (err?.code === "23505") {
      return NextResponse.json(
        { error: "Dit product of deze leverancier bestaat al" },
        { status: 409 }
      );
    }

    console.error("Fout bij opslaan product:", err);

    return NextResponse.json(
      {
        error: "Serverfout bij opslaan product",
        detail: foutmelding(err),
      },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const leverancierParameter = searchParams.get("leverancier");
  const alleenActief = searchParams.get("alleenActief") === "true";

  let leverancierId: number | null = null;

  if (leverancierParameter !== null) {
    leverancierId = Number(leverancierParameter);

    if (!Number.isInteger(leverancierId) || leverancierId <= 0) {
      return NextResponse.json(
        { error: "Ongeldige leverancier" },
        { status: 400 }
      );
    }
  }

  try {
    let result;

    if (leverancierId) {
      result = await db.query(
        `SELECT id,
                naam,
                bestelnummer,
                minimum_voorraad,
                besteleenheid,
                huidige_prijs,
                inhoud,
                eenheid,
                is_samengesteld,
                actief,
                volgorde
         FROM producten
         WHERE leverancier_id = $1
           AND ($2::boolean = false OR actief = true)
         ORDER BY volgorde NULLS LAST, naam`,
        [leverancierId, alleenActief]
      );
    } else {
      result = await db.query(
        `SELECT id,
                naam,
                bestelnummer,
                minimum_voorraad,
                besteleenheid,
                huidige_prijs,
                inhoud,
                eenheid,
                is_samengesteld,
                actief,
                volgorde
         FROM producten
         WHERE ($1::boolean = false OR actief = true)
         ORDER BY volgorde NULLS LAST, naam`,
        [alleenActief]
      );
    }

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("Fout bij ophalen producten:", err);

    return NextResponse.json(
      { error: "Serverfout bij ophalen producten" },
      { status: 500 }
    );
  }
}