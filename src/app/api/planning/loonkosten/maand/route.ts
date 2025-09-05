// src/app/api/planning/loonkosten/maand/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Pas dit aan als jouw week-endpoint anders heet:
const WEEK_ENDPOINT = '/api/planning/loonkosten/week';

type WeekResponse = {
  totaal: number;
};

function toIsoDate(d: Date) {
  const z = (n: number) => `${n}`.padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

// Maandag als weekstart (ISO) in lokale tijd
function startOfISOWeek(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (x.getDay() + 6) % 7; // 0 = ma
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfMonth(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  x.setHours(23, 59, 59, 999);
  return x;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const datumParam = url.searchParams.get('datum'); // YYYY-MM-DD
    if (!datumParam) {
      return NextResponse.json({ error: "query param 'datum' ontbreekt" }, { status: 400 });
    }

    const [y, m, dd] = datumParam.split('-').map(Number);
    if (!y || !m || !dd) {
      return NextResponse.json({ error: 'ongeldige datum (verwacht YYYY-MM-DD)' }, { status: 400 });
    }

    // Maandgrenzen
    const day = new Date(y, m - 1, dd);
    const monthStart = new Date(day.getFullYear(), day.getMonth(), 1);
    const monthEnd = endOfMonth(day);

    // Itereer over ISO-weken die deze maand raken (clip naar maandgrenzen)
    const cursor = startOfISOWeek(monthStart); // <— const i.p.v. let
    const origin = url.origin;

    let totaal = 0;
    const weeks: Array<{ start: string; end: string; totaal: number }> = [];

    while (cursor <= monthEnd) {
      const weekStart = new Date(cursor);
      const weekEnd = new Date(cursor);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      // Clip naar maand
      const rangeStart = weekStart < monthStart ? monthStart : weekStart;
      const rangeEnd = weekEnd > monthEnd ? monthEnd : weekEnd;

      const qs = new URLSearchParams({
        start: toIsoDate(rangeStart),
        end: toIsoDate(rangeEnd),
      });

      const res = await fetch(`${origin}${WEEK_ENDPOINT}?${qs.toString()}`, {
        method: 'GET',
        cache: 'no-store',
      });
      if (!res.ok) {
        const errText = await res.text();
        return NextResponse.json(
          { error: `Weekendpoint faalde: ${res.status} ${errText}` },
          { status: 500 }
        );
      }
      const data = (await res.json()) as WeekResponse;

      const wtot = Number(data?.totaal || 0);
      totaal += wtot;
      weeks.push({ start: toIsoDate(rangeStart), end: toIsoDate(rangeEnd), totaal: wtot });

      // Volgende week (we muteren het Date-object; const is oké)
      cursor.setDate(cursor.getDate() + 7);
    }

    return NextResponse.json({
      maand: {
        start: toIsoDate(monthStart),
        end: toIsoDate(monthEnd),
        totaal,
      },
      weeks,
    });
  } catch (err: any) {
    console.error('[loonkosten/maand] error:', err);
    return NextResponse.json({ error: 'Interne serverfout' }, { status: 500 });
  }
}
