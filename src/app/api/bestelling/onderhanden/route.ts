import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function bad(msg: string, code = 400) {
  return NextResponse.json({ error: msg }, { status: code });
}

function isEmptyData(obj: any) {
  if (!obj || typeof obj !== "object") return true;

  const keys = Object.keys(obj);
  if (keys.length === 0) return true;

  // Alle waarden ≤ 0 telt ook als leeg.
  return keys.every((k) => Number(obj[k]) <= 0);
}

/** GET /api/bestelling/onderhanden?leverancier=ID */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const leverancier = url.searchParams.get("leverancier");

  if (!leverancier) {
    return bad("leverancier is verplicht");
  }

  const leverancierId = Number(leverancier);

  if (!Number.isFinite(leverancierId) || leverancierId <= 0) {
    return bad("ongeldige leverancier");
  }

  try {
    const { rows } = await db.query(
      `select id, leverancier_id, referentie, data, aangemaakt_op, laatst_bewerkt
         from public.onderhanden_bestellingen
        where leverancier_id = $1
        limit 1`,
      [leverancierId]
    );

    return NextResponse.json(rows[0] ?? {
      leverancier_id: leverancierId,
      data: {},
    });
  } catch (err) {
    console.error("Fout bij ophalen onderhanden bestelling:", err);
    return bad("Serverfout", 500);
  }
}

/**
 * POST /api/bestelling/onderhanden
 * Body: { leverancier_id: number, data: jsonb, referentie?: string }
 *
 * - Lege data verwijdert een eventueel bestaand concept.
 * - Niet-lege data wordt per leverancier opgeslagen.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const leverancierId = Number(body?.leverancier_id);
    const data = (body?.data ?? {}) as Record<string, number>;
    const referentie = body?.referentie ?? null;

    if (!Number.isFinite(leverancierId) || leverancierId <= 0) {
      return bad("leverancier_id is verplicht");
    }

    /*
     * Wanneer het laatste aantal handmatig op 0 wordt gezet,
     * moet het oude concept ook verdwijnen. Alleen overslaan zou
     * ervoor zorgen dat de eerdere bestelling na verversen terugkomt.
     */
    if (isEmptyData(data)) {
      await db.query(
        `delete from public.onderhanden_bestellingen
          where leverancier_id = $1`,
        [leverancierId]
      );

      return NextResponse.json({
        ok: true,
        verwijderd: true,
        leverancier_id: leverancierId,
        data: {},
      });
    }

    await db.query(
      `insert into public.onderhanden_bestellingen
         (leverancier_id, referentie, data, aangemaakt_op, laatst_bewerkt)
       values ($1, $2, $3::jsonb, now(), now())
       on conflict (leverancier_id)
       do update set
         referentie = excluded.referentie,
         data = coalesce(
           public.onderhanden_bestellingen.data,
           '{}'::jsonb
         ) || excluded.data,
         laatst_bewerkt = now()`,
      [leverancierId, referentie, JSON.stringify(data)]
    );

    const { rows } = await db.query(
      `select id, leverancier_id, referentie, data, aangemaakt_op, laatst_bewerkt
         from public.onderhanden_bestellingen
        where leverancier_id = $1
        limit 1`,
      [leverancierId]
    );

    return NextResponse.json(
      rows[0] ?? {
        leverancier_id: leverancierId,
        data: {},
      }
    );
  } catch (err) {
    console.error("Fout bij opslaan onderhanden bestelling:", err);
    return bad("Serverfout", 500);
  }
}

/** DELETE /api/bestelling/onderhanden?leverancier=ID */
export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const leverancier = url.searchParams.get("leverancier");

  if (!leverancier) {
    return bad("leverancier is verplicht");
  }

  const leverancierId = Number(leverancier);

  if (!Number.isFinite(leverancierId) || leverancierId <= 0) {
    return bad("ongeldige leverancier");
  }

  try {
    await db.query(
      `delete from public.onderhanden_bestellingen
        where leverancier_id = $1`,
      [leverancierId]
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Fout bij verwijderen onderhanden bestelling:", err);
    return bad("Serverfout", 500);
  }
}