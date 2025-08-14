import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function bad(msg: string, code = 400) {
  return NextResponse.json({ error: msg }, { status: code });
}

function isEmptyData(obj: any) {
  if (!obj || typeof obj !== "object") return true;
  const keys = Object.keys(obj);
  if (keys.length === 0) return true;
  // alle waarden ≤ 0 telt ook als leeg
  return keys.every((k) => Number(obj[k]) <= 0);
}

/** GET /api/bestelling/onderhanden?leverancier=ID */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const leverancier = url.searchParams.get("leverancier");
  if (!leverancier) return bad("leverancier is verplicht");

  const { rows } = await db.query(
    `select id, leverancier_id, referentie, data, aangemaakt_op, laatst_bewerkt
       from public.onderhanden_bestellingen
      where leverancier_id = $1
      limit 1`,
    [Number(leverancier)]
  );
  return NextResponse.json(rows[0] ?? { data: {} });
}

/**
 * POST /api/bestelling/onderhanden
 * Body: { leverancier_id: number, data: jsonb, referentie?: string }
 * - NO-OP bij lege data (maakt géén lege rij aan)
 * - Merge JSONB per leverancier
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const leverancier_id = Number(body?.leverancier_id);
  const data = (body?.data ?? {}) as Record<string, number>;
  const referentie = body?.referentie ?? null;
  if (!leverancier_id) return bad("leverancier_id is verplicht");

  // ⛔ Niets opslaan als data leeg is. Bestaat er al een rij? Dan laten we die ongemoeid.
  if (isEmptyData(data)) {
    return NextResponse.json({ ok: true, skipped: true });
  }

  await db.query(
    `insert into public.onderhanden_bestellingen
       (leverancier_id, referentie, data, aangemaakt_op, laatst_bewerkt)
     values ($1, $2, $3::jsonb, now(), now())
     on conflict (leverancier_id)
     do update set
       referentie = excluded.referentie,
       data = coalesce(public.onderhanden_bestellingen.data, '{}'::jsonb) || excluded.data,
       laatst_bewerkt = now()`,
    [leverancier_id, referentie, JSON.stringify(data)]
  );

  const { rows } = await db.query(
    `select id, leverancier_id, referentie, data, aangemaakt_op, laatst_bewerkt
       from public.onderhanden_bestellingen
      where leverancier_id = $1
      limit 1`,
    [leverancier_id]
  );
  return NextResponse.json(rows[0] ?? { data: {} });
}

/** DELETE /api/bestelling/onderhanden?leverancier=ID */
export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const leverancier = url.searchParams.get("leverancier");
  if (!leverancier) return bad("leverancier is verplicht");

  await db.query(
    `delete from public.onderhanden_bestellingen where leverancier_id = $1`,
    [Number(leverancier)]
  );
  return NextResponse.json({ ok: true });
}
