import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

function toBool(v: unknown) {
  return v === true || v === "true" || v === 1 || v === "1";
}

function normalizeWeekdagen(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  const geldig = new Set(["ma", "di", "wo", "do", "vr", "za", "zo"]);
  return input
    .map((x) => String(x).toLowerCase())
    .filter((x) => geldig.has(x));
}

export async function GET(_: Request, context: { params: Params }) {
  const { id } = await context.params;
  const routineId = Number(id);

  if (!Number.isFinite(routineId)) {
    return NextResponse.json({ error: "Ongeldig routine-id" }, { status: 400 });
  }

  const result = await query(
    `
    SELECT
      id,
      routine_id,
      naam,
      kleurcode,
      reinigen,
      desinfecteren,
      frequentie,
      weekdagen,
      sortering,
      actief
    FROM routine_taken
    WHERE routine_id = $1
    ORDER BY sortering ASC, id ASC
    `,
    [routineId]
  );

  return NextResponse.json(result.rows);
}

export async function POST(request: Request, context: { params: Params }) {
  const { id } = await context.params;
  const routineId = Number(id);

  if (!Number.isFinite(routineId)) {
    return NextResponse.json({ error: "Ongeldig routine-id" }, { status: 400 });
  }

  const body = await request.json();

  const naam = String(body?.naam || "").trim();
  const kleurcode =
    body?.kleurcode === "roze" || body?.kleurcode === "groen" || body?.kleurcode === "geel"
      ? body.kleurcode
      : null;

  const frequentie =
    body?.frequentie === "D" || body?.frequentie === "W" || body?.frequentie === "2D"
      ? body.frequentie
      : "D";

  const reinigen = toBool(body?.reinigen);
  const desinfecteren = toBool(body?.desinfecteren);
  const weekdagen = normalizeWeekdagen(body?.weekdagen);

  if (!naam) {
    return NextResponse.json({ error: "Naam is verplicht" }, { status: 400 });
  }

  const sorteringResult = await query(
    `
    SELECT COALESCE(MAX(sortering), 0) + 10 AS next_sortering
    FROM routine_taken
    WHERE routine_id = $1
    `,
    [routineId]
  );

  const sortering = Number(sorteringResult.rows[0]?.next_sortering || 10);

  const insert = await query(
    `
    INSERT INTO routine_taken
      (routine_id, naam, kleurcode, reinigen, desinfecteren, frequentie, weekdagen, sortering, actief)
    VALUES
      ($1, $2, $3, $4, $5, $6, $7::text[], $8, true)
    RETURNING *
    `,
    [routineId, naam, kleurcode, reinigen, desinfecteren, frequentie, weekdagen, sortering]
  );

  return NextResponse.json(insert.rows[0]);
}

export async function PATCH(request: Request, context: { params: Params }) {
  const { id } = await context.params;
  const routineId = Number(id);

  if (!Number.isFinite(routineId)) {
    return NextResponse.json({ error: "Ongeldig routine-id", rawId: id }, { status: 400 });
  }

  const body = await request.json();

  console.log("PATCH routine taak body", body);
  console.log("PATCH routine id param", id);

  const taakId = Number(body?.id);
  const naam = String(body?.naam || "").trim();
  const kleurcode =
    body?.kleurcode === "roze" || body?.kleurcode === "groen" || body?.kleurcode === "geel"
      ? body.kleurcode
      : null;
  const frequentie =
    body?.frequentie === "D" || body?.frequentie === "W" || body?.frequentie === "2D"
      ? body.frequentie
      : "D";
  const reinigen = toBool(body?.reinigen);
  const desinfecteren = toBool(body?.desinfecteren);
  const weekdagen = normalizeWeekdagen(body?.weekdagen);
  const sortering = Number(body?.sortering || 0);
  const actief = body?.actief == null ? true : toBool(body?.actief);

  console.log("PATCH parsed", {
    routineId,
    taakId,
    naam,
    kleurcode,
    frequentie,
    reinigen,
    desinfecteren,
    weekdagen,
    sortering,
    actief,
  });

  if (!Number.isFinite(taakId)) {
    return NextResponse.json({ error: "Ongeldig taak-id", rawTaakId: body?.id }, { status: 400 });
  }

  if (!naam) {
    return NextResponse.json({ error: "Naam is verplicht" }, { status: 400 });
  }

  const update = await query(
    `
    UPDATE routine_taken
    SET
      naam = $1,
      kleurcode = $2,
      reinigen = $3,
      desinfecteren = $4,
      frequentie = $5,
      weekdagen = $6::text[],
      sortering = $7,
      actief = $8
    WHERE id = $9
      AND routine_id = $10
    RETURNING *
    `,
    [naam, kleurcode, reinigen, desinfecteren, frequentie, weekdagen, sortering, actief, taakId, routineId]
  );

  console.log("PATCH update rows", update.rows);

  if (!update.rows[0]) {
    return NextResponse.json(
      { error: "Taak niet gevonden", taakId, routineId },
      { status: 404 }
    );
  }

  return NextResponse.json(update.rows[0]);
}

export async function DELETE(request: Request, context: { params: Params }) {
  const { id } = await context.params;
  const routineId = Number(id);

  if (!Number.isFinite(routineId)) {
    return NextResponse.json({ error: "Ongeldig routine-id" }, { status: 400 });
  }

  const body = await request.json();
  const taakId = Number(body?.id);

  if (!Number.isFinite(taakId)) {
    return NextResponse.json({ error: "Ongeldig taak-id" }, { status: 400 });
  }

  await query(
    `
    DELETE FROM routine_taken
    WHERE id = $1 AND routine_id = $2
    `,
    [taakId, routineId]
  );

  return NextResponse.json({ ok: true });
}