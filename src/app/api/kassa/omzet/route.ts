// Bestand: src/app/api/kassa/omzet/route.ts
import { NextResponse } from 'next/server'

const KASSA_BASE = 'https://www.pcadmin.nl/kassaapp/api.php'
const KASSA_USER = process.env.KASSA_USER!
const KASSA_PASS = process.env.KASSA_PASS!

async function fetchKassa(params: string) {
  const url = `${KASSA_BASE}?${params}`
  const res = await fetch(url, {
    headers: {
      // Basic Auth, of pas aan naar Bearer indien nodig
      'Authorization': 'Basic ' + Buffer.from(`${KASSA_USER}:${KASSA_PASS}`).toString('base64'),
      'Accept': 'application/json',
    },
    // Vercel zet automatisch de juiste NODE_TLS_REJECT_UNAUTHORIZED etc. 
  })
  if (!res.ok) throw new Error(`Kassa API error (${res.status}): ${await res.text()}`)
  return res.json()
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    // twee modes: enkel 'totalen' van vandaag, of range tussen start & einde
    if (searchParams.has('totalen')) {
      // /api/kassa/omzet?start=DD-MM-YYYY&totalen=1
      const start = searchParams.get('start')
      const data = await fetchKassa(`start=${encodeURIComponent(start!)}&totalen=1`)
      return NextResponse.json(data)
    } else {
      // /api/kassa/omzet?start=DD-MM-YYYY&einde=DD-MM-YYYY
      const start = searchParams.get('start')
      const einde = searchParams.get('einde')
      const data = await fetchKassa(`start=${encodeURIComponent(start!)}&einde=${encodeURIComponent(einde!)}`)
      return NextResponse.json(data)
    }
  } catch (err: any) {
    console.error('API /api/kassa/omzet fout:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
