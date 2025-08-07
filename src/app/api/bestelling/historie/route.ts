// /src/app/api/bestelling/historie/route.ts
import { NextRequest, NextResponse } from "next/server";
import { pool } from "@/lib/db";
export async function POST(req: NextRequest) {
  const { leverancier_id, data, referentie, opmerking } = await req.json();

  if (!leverancier_id || !data) {
    return NextResponse.json({ error: "Leverancier en data zijn verplicht." }, { status: 400 });
  }

  // Fallback-referentie opbouwen
  let ref = referentie;
  if (!ref || ref.trim() === "") {
    ref = `${new Date().toISOString().replace(/[-:T.Z]/g, "")}-${leverancier_id}`;
  }

  console.log("⬇️ Bestelling ontvangen:", { leverancier_id, referentie: ref, data });

  try {
    await pool.query(
      `INSERT INTO bestellingen (leverancier_id, data, referentie, opmerkingen, besteld_op, kanaal)
       VALUES ($1, $2, $3, $4, now(), 'mail')`,
      [leverancier_id, data, ref, opmerking]
    );
    console.log("✅ Bestelling succesvol opgeslagen");
    return NextResponse.json({ success: true });
  } catch (err: any) {
    if (err.code === '23505') {
      const fallbackReferentie = `${ref}-${Date.now()}`;
      try {
        await pool.query(
          `INSERT INTO bestellingen (leverancier_id, data, referentie, opmerkingen, besteld_op, kanaal)
           VALUES ($1, $2, $3, $4, now(), 'mail')`,
          [leverancier_id, data, fallbackReferentie, opmerking]
        );
        console.warn(`⚠️ Referentie was dubbel. Fallback gebruikt: ${fallbackReferentie}`);
        return NextResponse.json({ success: true, fallbackReferentie });
      } catch (err2) {
        console.error("❌ Tweede poging (fallback) mislukt:", err2);
        return NextResponse.json({ success: false, error: String(err2) }, { status: 500 });
      }
    }

    console.error("❌ Fout bij opslaan bestelling:", err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}



export async function GET(req: NextRequest) {
  const leverancier = req.nextUrl.searchParams.get("leverancier");
  if (!leverancier) {
    return NextResponse.json({ error: "Leverancier vereist" }, { status: 400 });
  }

  const result = await pool.query(
    `SELECT id, referentie, besteld_op, data
     FROM bestellingen
     WHERE leverancier_id = $1
     ORDER BY besteld_op DESC
     LIMIT 20`,
    [leverancier]
  );

  return NextResponse.json(result.rows);
}
