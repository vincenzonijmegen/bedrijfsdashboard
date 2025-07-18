// src/app/api/kassa/omzet/route.ts

import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

const KASSA_BASE = process.env.KASSA_API_URL!; // bv. https://89.98.65.61/admin/api.php
const KASSA_USER = process.env.KASSA_USER!;
const KASSA_PASS = process.env.KASSA_PASS!;

// Fetch helper voor kassa-API
async function fetchKassa(params: string) {
  const url = `${KASSA_BASE}?${params}`;
  const res = await fetch(url, {
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${KASSA_USER}:${KASSA_PASS}`).toString('base64'),
      'Accept': 'application/json'
    }
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kassa API error (${res.status}): ${text}`);
  }
  return res.json();
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const start = searchParams.get('start');
  const totalen = searchParams.get('totalen');

  if (!start) {
    return NextResponse.json({ success: false, error: 'Parameter "start" ontbreekt' }, { status: 400 });
  }

  try {
    if (totalen) {
      // Dagtotalen
      const data = await fetchKassa(`start=${encodeURIComponent(start)}&totalen=1`);
      return NextResponse.json(data);
    } else {
      // Transacties binnen range
      const einde = searchParams.get('einde');
      if (!einde) {
        return NextResponse.json({ success: false, error: 'Parameter "einde" ontbreekt' }, { status: 400 });
      }
      const data = await fetchKassa(`start=${encodeURIComponent(start)}&einde=${encodeURIComponent(einde)}`);
      return NextResponse.json(data);
    }
  } catch (err: any) {
    console.error('API /api/kassa/omzet fout:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
