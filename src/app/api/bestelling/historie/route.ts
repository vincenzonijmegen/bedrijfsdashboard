// /src/app/api/bestelling/historie/route.ts

import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";

function heeftBestelregels(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return false;
  }

  return Object.values(data).some((aantal) => Number(aantal) > 0);
}

export async function POST(req: NextRequest) {
  try {
    const { leverancier_id, data, referentie, opmerking } = await req.json();

    const leverancierId = Number(leverancier_id);

    if (!Number.isFinite(leverancierId) || leverancierId <= 0) {
      return NextResponse.json(
        { error: "Een geldige leverancier is verplicht." },
        { status: 400 }
      );
    }

    if (!heeftBestelregels(data)) {
      return NextResponse.json(
        { error: "De bestelling bevat geen bestelregels." },
        { status: 400 }
      );
    }

    // Fallback-referentie opbouwen
    let ref =
      typeof referentie === "string" ? referentie.trim() : "";

    if (!ref) {
      ref = `${new Date()
        .toISOString()
        .replace(/[-:T.Z]/g, "")}-${leverancierId}`;
    }

    console.log("⬇️ Bestelling ontvangen:", {
      leverancier_id: leverancierId,
      referentie: ref,
      data,
    });

    try {
      await pool.query(
        `INSERT INTO bestellingen
          (leverancier_id, data, referentie, opmerkingen, besteld_op, kanaal)
         VALUES ($1, $2, $3, $4, now(), 'mail')`,
        [
          leverancierId,
          data,
          ref,
          typeof opmerking === "string" ? opmerking : null,
        ]
      );

      console.log("✅ Bestelling succesvol opgeslagen");

      return NextResponse.json({ success: true });
    } catch (err: any) {
      if (err?.code === "23505") {
        const fallbackReferentie = `${ref}-${Date.now()}`;

        try {
          await pool.query(
            `INSERT INTO bestellingen
              (leverancier_id, data, referentie, opmerkingen, besteld_op, kanaal)
             VALUES ($1, $2, $3, $4, now(), 'mail')`,
            [
              leverancierId,
              data,
              fallbackReferentie,
              typeof opmerking === "string" ? opmerking : null,
            ]
          );

          console.warn(
            `⚠️ Referentie was dubbel. Fallback gebruikt: ${fallbackReferentie}`
          );

          return NextResponse.json({
            success: true,
            fallbackReferentie,
          });
        } catch (err2) {
          console.error("❌ Tweede poging (fallback) mislukt:", err2);

          return NextResponse.json(
            {
              success: false,
              error: err2 instanceof Error ? err2.message : String(err2),
            },
            { status: 500 }
          );
        }
      }

      console.error("❌ Fout bij opslaan bestelling:", err);

      return NextResponse.json(
        {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        },
        { status: 500 }
      );
    }
  } catch (err) {
    console.error("❌ Ongeldige aanvraag bij opslaan bestelling:", err);

    return NextResponse.json(
      { success: false, error: "Ongeldige aanvraag." },
      { status: 400 }
    );
  }
}

export async function GET(req: NextRequest) {
  const leverancier = req.nextUrl.searchParams.get("leverancier");
  const leverancierId = Number(leverancier);

  if (!Number.isFinite(leverancierId) || leverancierId <= 0) {
    return NextResponse.json(
      { error: "Een geldige leverancier is vereist." },
      { status: 400 }
    );
  }

  try {
    const result = await pool.query(
      `SELECT id, referentie, besteld_op, data
       FROM bestellingen
       WHERE leverancier_id = $1
       ORDER BY besteld_op DESC
       LIMIT 20`,
      [leverancierId]
    );

    return NextResponse.json(result.rows);
  } catch (err) {
    console.error("❌ Fout bij ophalen bestelhistorie:", err);

    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Serverfout",
      },
      { status: 500 }
    );
  }
}