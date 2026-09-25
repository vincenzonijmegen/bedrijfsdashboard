import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function parseDateOnly(value: unknown) {
  const s = String(value ?? "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error("Ongeldige datum");
  return s;
}

function monthDiff(from: string, to: string) {
  const fy = Number(from.slice(0, 4));
  const fm = Number(from.slice(5, 7));
  const ty = Number(to.slice(0, 4));
  const tm = Number(to.slice(5, 7));
  return (ty - fy) * 12 + (tm - fm);
}

function addMonths(dateStr: string, amount: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + amount, d));
  return dt.toISOString().slice(0, 10);
}

function intervalMonths(frequency: string) {
  if (frequency === "maandelijks") return 1;
  if (frequency === "per_kwartaal") return 3;
  if (frequency === "halfjaarlijks") return 6;
  if (frequency === "jaarlijks") return 12;
  return null;
}

type StreamRow = {
  id: number;
  entity: string;
  name: string;
  category: string;
  behavior: string;
  postponable: boolean;
  frequency: string;
  startDate: string;
  endDate: string | null;
};

type RateRow = {
  validFrom: string;
  validTo: string | null;
  amount: number | null;
};

type PlanRow = {
  id: number;
  streamId: number;
  originalDate: string;
  plannedDate: string;
  amount: number;
  status: string;
  reason: string | null;
  manual: boolean;
  paidOn: string | null;
};

async function getPlanningData(toYear: number) {
  const streamsRes = await db.query(`
    SELECT s.id,
           e.naam AS entiteit,
           s.naam,
           s.categorie,
           s.gedrag,
           s.uitstelbaar,
           s.frequentie,
           s.startdatum::text AS startdatum,
           s.einddatum::text AS einddatum
    FROM cashflow_stromen s
    JOIN cashflow_entiteiten e ON e.id = s.van_entiteit_id
    WHERE s.actief = true
      AND e.actief = true
      AND s.gedrag = 'planbaar'
      AND s.uitstelbaar = true
      AND s.berekeningswijze = 'vast_bedrag'
    ORDER BY e.naam, s.id
  `);

  const streams: StreamRow[] = (streamsRes.rows ?? []).map((r) => ({
    id: Number(r.id),
    entity: String(r.entiteit),
    name: String(r.naam),
    category: String(r.categorie),
    behavior: String(r.gedrag),
    postponable: Boolean(r.uitstelbaar),
    frequency: String(r.frequentie),
    startDate: parseDateOnly(r.startdatum),
    endDate: r.einddatum == null ? null : parseDateOnly(r.einddatum),
  }));

  const ids = streams.map((s) => s.id);
  if (!ids.length) {
    return { toYear, occurrences: [], summary: { total: 0, postponed: 0, paid: 0, cancelled: 0 } };
  }

  const [ratesRes, plansRes] = await Promise.all([
    db.query(`
      SELECT stroom_id,
             geldig_vanaf::text AS geldig_vanaf,
             geldig_tot::text AS geldig_tot,
             bedrag
      FROM cashflow_stroom_bedragen
      WHERE stroom_id = ANY($1::int[])
      ORDER BY stroom_id, geldig_vanaf
    `, [ids]),
    db.query(`
      SELECT id,
             stroom_id,
             oorspronkelijke_datum::text AS oorspronkelijke_datum,
             geplande_datum::text AS geplande_datum,
             bedrag,
             status,
             reden,
             handmatig_aangepast,
             betaald_op::text AS betaald_op
      FROM cashflow_planning
      WHERE stroom_id = ANY($1::int[])
      ORDER BY stroom_id, oorspronkelijke_datum
    `, [ids]),
  ]);

  const rates = new Map<number, RateRow[]>();
  for (const r of ratesRes.rows ?? []) {
    const streamId = Number(r.stroom_id);
    if (!rates.has(streamId)) rates.set(streamId, []);
    rates.get(streamId)!.push({
      validFrom: parseDateOnly(r.geldig_vanaf),
      validTo: r.geldig_tot == null ? null : parseDateOnly(r.geldig_tot),
      amount: r.bedrag == null ? null : Number(r.bedrag),
    });
  }

  const plans = new Map<string, PlanRow>();
  for (const r of plansRes.rows ?? []) {
    const p: PlanRow = {
      id: Number(r.id),
      streamId: Number(r.stroom_id),
      originalDate: parseDateOnly(r.oorspronkelijke_datum),
      plannedDate: parseDateOnly(r.geplande_datum),
      amount: Number(r.bedrag),
      status: String(r.status),
      reason: r.reden == null ? null : String(r.reden),
      manual: Boolean(r.handmatig_aangepast),
      paidOn: r.betaald_op == null ? null : parseDateOnly(r.betaald_op),
    };
    plans.set(`${p.streamId}|${p.originalDate}`, p);
  }

  const rateForDate = (streamId: number, date: string) => {
    return (rates.get(streamId) ?? [])
      .filter((r) => r.validFrom <= date && (r.validTo == null || r.validTo >= date))
      .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0] ?? null;
  };

  const occurrences: Array<Record<string, unknown>> = [];
  for (const stream of streams) {
    const interval = intervalMonths(stream.frequency);
    const oneTime = stream.frequency === "eenmalig";
    if (!oneTime && interval == null) continue;

    let current = stream.startDate;
    while (Number(current.slice(0, 4)) <= toYear) {
      if (stream.endDate && current > stream.endDate) break;

      const plan = plans.get(`${stream.id}|${current}`) ?? null;
      const rate = rateForDate(stream.id, current);
      const plannedDate = plan?.status === "betaald" && plan.paidOn
        ? plan.paidOn
        : (plan?.plannedDate ?? current);
      const status = plan?.status ?? "standaard";

      occurrences.push({
        entity: stream.entity,
        streamId: stream.id,
        streamName: stream.name,
        category: stream.category,
        originalDate: current,
        plannedDate,
        amount: plan?.amount ?? rate?.amount ?? null,
        status,
        postponed: status === "uitgesteld" || plannedDate > current,
        manual: plan?.manual ?? false,
        reason: plan?.reason ?? null,
        paidOn: plan?.paidOn ?? null,
        planningId: plan?.id ?? null,
      });

      if (oneTime) break;
      current = addMonths(current, interval!);
    }
  }

  return {
    toYear,
    occurrences,
    summary: {
      total: occurrences.length,
      postponed: occurrences.filter((x) => x.postponed === true).length,
      paid: occurrences.filter((x) => x.status === "betaald").length,
      cancelled: occurrences.filter((x) => x.status === "vervallen").length,
    },
  };
}

async function getEligibleStream(streamId: number) {
  const res = await db.query(`
    SELECT s.id,
           s.naam,
           s.frequentie,
           s.startdatum::text AS startdatum,
           s.einddatum::text AS einddatum
    FROM cashflow_stromen s
    JOIN cashflow_entiteiten e ON e.id = s.van_entiteit_id
    WHERE s.id = $1
      AND s.actief = true
      AND e.actief = true
      AND s.gedrag = 'planbaar'
      AND s.uitstelbaar = true
      AND s.berekeningswijze = 'vast_bedrag'
    LIMIT 1
  `, [streamId]);
  const row = res.rows?.[0];
  if (!row) throw new Error("Geldstroom is niet planbaar en uitstelbaar");
  return {
    id: Number(row.id),
    name: String(row.naam),
    frequency: String(row.frequentie),
    startDate: parseDateOnly(row.startdatum),
    endDate: row.einddatum == null ? null : parseDateOnly(row.einddatum),
  };
}

function validateOccurrence(stream: { frequency: string; startDate: string; endDate: string | null }, originalDate: string) {
  if (originalDate < stream.startDate) throw new Error("Oorspronkelijke datum ligt vóór de startdatum");
  if (stream.endDate && originalDate > stream.endDate) throw new Error("Oorspronkelijke datum ligt na de einddatum");

  if (stream.frequency === "eenmalig") {
    if (originalDate !== stream.startDate) {
      throw new Error("Oorspronkelijke datum is geen geldige standaardtermijn van deze stroom");
    }
    return;
  }

  const interval = intervalMonths(stream.frequency);
  if (interval == null) throw new Error("Frequentie wordt niet ondersteund");
  const diff = monthDiff(stream.startDate, originalDate);
  if (diff < 0 || diff % interval !== 0 || originalDate.slice(8, 10) !== stream.startDate.slice(8, 10)) {
    throw new Error("Oorspronkelijke datum is geen geldige standaardtermijn van deze stroom");
  }
}

async function defaultAmount(streamId: number, originalDate: string) {
  const res = await db.query(`
    SELECT bedrag
    FROM cashflow_stroom_bedragen
    WHERE stroom_id = $1
      AND geldig_vanaf <= $2::date
      AND (geldig_tot IS NULL OR geldig_tot >= $2::date)
    ORDER BY geldig_vanaf DESC
    LIMIT 1
  `, [streamId, originalDate]);
  const row = res.rows?.[0];
  if (!row || row.bedrag == null) throw new Error("Geen standaardbedrag geconfigureerd voor deze termijn");
  return Number(row.bedrag);
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const currentYear = new Date().getFullYear();
    const toYear = Number(url.searchParams.get("tot") ?? currentYear + 3);
    if (!Number.isInteger(toYear) || toYear < currentYear || toYear > currentYear + 10) {
      return NextResponse.json({ success: false, error: `tot moet tussen ${currentYear} en ${currentYear + 10} liggen` }, { status: 400 });
    }
    return NextResponse.json({ success: true, fase: "4H", data: await getPlanningData(toYear) });
  } catch (error) {
    return NextResponse.json({ success: false, fase: "4H", error: String(error) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const streamId = Number(body?.stream_id);
    if (!Number.isInteger(streamId)) throw new Error("Ongeldige stroom_id");

    const originalDate = parseDateOnly(body?.oorspronkelijke_datum);
    const plannedDate = parseDateOnly(body?.geplande_datum);
    if (plannedDate < originalDate) throw new Error("Een betaling mag niet vóór de oorspronkelijke datum worden gepland");

    const stream = await getEligibleStream(streamId);
    validateOccurrence(stream, originalDate);

    const requestedAmount = body?.bedrag === null || body?.bedrag === undefined || body?.bedrag === ""
      ? await defaultAmount(streamId, originalDate)
      : Number(body.bedrag);
    if (!Number.isFinite(requestedAmount) || requestedAmount < 0) throw new Error("Ongeldig bedrag");

    const reason = body?.reden == null || String(body.reden).trim() === "" ? null : String(body.reden).trim();
    const status = plannedDate > originalDate ? "uitgesteld" : "gepland";

    await db.query(`
      INSERT INTO cashflow_planning (
        stroom_id, periode, oorspronkelijke_datum, geplande_datum,
        bedrag, status, reden, handmatig_aangepast, betaald_op
      ) VALUES ($1,$2,$2,$3,$4,$5,$6,true,NULL)
      ON CONFLICT (stroom_id, oorspronkelijke_datum) DO UPDATE
      SET periode = EXCLUDED.periode,
          geplande_datum = EXCLUDED.geplande_datum,
          bedrag = EXCLUDED.bedrag,
          status = EXCLUDED.status,
          reden = EXCLUDED.reden,
          handmatig_aangepast = true,
          betaald_op = NULL,
          bijgewerkt_op = now()
    `, [streamId, originalDate, plannedDate, requestedAmount, status, reason]);

    return NextResponse.json({
      success: true,
      fase: "4H",
      saved: {
        streamId,
        streamName: stream.name,
        originalDate,
        plannedDate,
        amount: requestedAmount,
        status,
        reason,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, fase: "4H", error: String(error) }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json();
    const streamId = Number(body?.stream_id);
    if (!Number.isInteger(streamId)) throw new Error("Ongeldige stroom_id");
    const originalDate = parseDateOnly(body?.oorspronkelijke_datum);

    const stream = await getEligibleStream(streamId);
    validateOccurrence(stream, originalDate);

    const result = await db.query(`
      DELETE FROM cashflow_planning
      WHERE stroom_id = $1
        AND oorspronkelijke_datum = $2::date
        AND status <> 'betaald'
      RETURNING id
    `, [streamId, originalDate]);

    if (!result.rowCount) {
      return NextResponse.json({
        success: false,
        fase: "4H",
        error: "Geen verwijderbare planning gevonden; betaalde regels worden niet verwijderd",
      }, { status: 404 });
    }

    return NextResponse.json({ success: true, fase: "4H", reset: { streamId, originalDate } });
  } catch (error) {
    return NextResponse.json({ success: false, fase: "4H", error: String(error) }, { status: 400 });
  }
}
