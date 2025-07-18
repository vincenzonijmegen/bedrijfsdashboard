// src/app/api/kassa/omzet/route.ts

import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';

const KASSA_BASE = process.env.KASSA_API_URL!; // bv. https://89.98.65.61/admin/api.php
const KASSA_USER = process.env.KASSA_USER!;
const KASSA_PASS = process.env.KASSA_PASS!;

// Normalizeer DD-MM-YYYY of ISO YYYY-MM-DD naar DD-MM-YYYY voor kassa-API
// Voor zelf-ondertekende certificaten (NIET aanbevolen voor productie)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Normalizeer DD-MM-YYYY of ISO YYYY-MM-DD naar DD-MM-YYYY voor kassa-API
const normalizeDateParam = (dateStr: string) => {
  const parts = dateStr.split('-').map(s => s.padStart(2, '0'));
  // Als ISO (YYYY-MM-DD)
  if (parts[0].length === 4) {
    const [y, m, d] = parts;
    return `${d}-${m}-${y}`;
  }
  // Anders DD-MM-YYYY
  const [d, m, y] = parts;
  return `${d}-${m}-${y}`;
};

// Fetch helper voor kassa-API
async function fetchKassa(params: string) {
  const url = `${KASSA_BASE}?${params}`;
  console.log('Fetch Kassa URL:', url);
  const res = await fetch(url, {
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${KASSA_USER}:${KASSA_PASS}`).toString('base64'),
      'Accept': 'application/json'
    }
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Kassa API error (${res.status}): ${text}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invalid JSON from Kassa API: ${text}`);
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startRaw = searchParams.get('start');
  const totalen = searchParams.get('totalen');
  console.log('API GET kassa/omzet params:', { startRaw, totalen });

  if (!startRaw) {
    return NextResponse.json({ success: false, error: 'Parameter "start" ontbreekt' }, { status: 400 });
  }
  const start = normalizeDateParam(startRaw);

  try {
    if (totalen) {
      // Dagtotalen
      const data = await fetchKassa(`start=${encodeURIComponent(start)}&totalen=1`);
      return NextResponse.json(data);
    } else {
      // Transacties binnen range
      const eindeRaw = searchParams.get('einde');
      if (!eindeRaw) {
        return NextResponse.json({ success: false, error: 'Parameter "einde" ontbreekt' }, { status: 400 });
      }
      const einde = normalizeDateParam(eindeRaw);
      const data = await fetchKassa(`start=${encodeURIComponent(start)}&einde=${encodeURIComponent(einde)}`);
      return NextResponse.json(data);
    }
  } catch (err: any) {
    console.error('API /api/kassa/omzet fout:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
