import { NextResponse } from 'next/server';

const BASE  = process.env.REKENSERVICE_URL!;
const TOKEN = process.env.API_REKEN_TOKEN!;

export async function POST(req: Request) {
  if (!BASE || !TOKEN) {
    return NextResponse.json({ error: 'Env vars missen' }, { status: 500 });
  }

  const { date, doel_pct = 0.23 } = await req.json();

  // 1) Forecast (idempotent)
  let r = await fetch(`${BASE}/forecast/day`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ date }),
  });
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: r.status });

  // 2) Optimize
  r = await fetch(`${BASE}/optimize/day`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ date, doel_pct }),
  });

  const text = await r.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }

  return NextResponse.json(data, { status: r.status });
}
