import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export async function POST(request: Request, context: { params: Params }) {
  const { id } = await context.params;
  const routineId = Number(id);

  if (!Number.isFinite(routineId)) {
    return NextResponse.json({ error: "Ongeldig routine-id" }, { status: 400 });
  }

  const body = await request.json();
  const items = Array.isArray(body?.items) ? body.items : [];

  for (const item of items) {
    const taakId = Number(item?.id);
    const sortering = Number(item?.sortering);

    if (!Number.isFinite(taakId) || !Number.isFinite(sortering)) continue;

    await query(
      `
      UPDATE routine_taken
      SET sortering = $1
      WHERE id = $2 AND routine_id = $3
      `,
      [sortering, taakId, routineId]
    );
  }

  return NextResponse.json({ ok: true });
}