// src/app/api/rapportage/profielen/overzicht/route.ts
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

type Row = {
  isodow: number; // 1..7 (ma..zo)
  uur: number;    // 0..23
  kwartier: number; // 1..4
  omzet_avg: string; // numeric from PG
};

const PAD = (n: number) => String(n).padStart(2, "0");
const WD_NL = ["", "maandag", "dinsdag", "woensdag", "donderdag", "vrijdag", "zaterdag", "zondag"];

function openCloseFor(maand: number, isodow: number) {
  // Openingstijden:
  // - Maart: 12:00–20:00 (zo: 13:00–20:00)
  // - Overige maanden: 12:00–22:00 (zo: 13:00–22:00)
  // NB: we tonen géén opstart/schoonmaak hier (alleen verkooptijden, zoals je voorbeeld 12:00–...)
  if (maand === 3) {
    return {
      openHour: isodow === 7 ? 13 : 12,
      closeHour: 20,
    };
  }
  return {
    openHour: isodow === 7 ? 13 : 12,
    closeHour: 22,
  };
}

function labelFor(uur: number, kwartier: number) {
  // kwartier 1..4  => 00, 15, 30, 45
  const startMin = (kwartier - 1) * 15;
  const endMin = startMin + 15;
  const fromH = uur;
  const fromM = startMin;
  const endH = fromH + Math.floor(endMin / 60);
  const endM = endMin % 60;
  return `${PAD(fromH)}:${PAD(fromM)} - ${PAD(endH)}:${PAD(endM)}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const maand = Number(searchParams.get("maand") || "0");
    if (!Number.isInteger(maand) || maand < 1 || maand > 12) {
      return NextResponse.json({ ok: false, error: "Geef ?maand=1..12 mee." }, { status: 400 });
    }

    // DB dynamisch importeren zodat eventuele import-fouten netjes als JSON terugkomen
    const mod = await import("@/lib/dbRapportage");
    const db = mod.dbRapportage;

    // Haal alle profiel-rijen voor deze maand op
    const sql = `
      SELECT isodow, uur, kwartier, omzet_avg
      FROM rapportage.omzet_profiel_mw_kwartier
      WHERE maand = $1
      ORDER BY isodow, uur, kwartier
    `;
    const rs = await db.query(sql, [maand]);
    const rows = (rs.rows as Row[]).map(r => ({
      isodow: Number(r.isodow),
      uur: Number(r.uur),
      kwartier: Number(r.kwartier),
      omzet_avg: Number(r.omzet_avg || 0),
    }));

    // Snel opzoekbaar maken
    const key = (d: number, h: number, q: number) => `${d}-${h}-${q}`;
    const map = new Map<string, number>();
    for (const r of rows) {
      map.set(key(r.isodow, r.uur, r.kwartier), r.omzet_avg);
    }

    // Bouw per weekdag de lijst van tijdvakken binnen de openingstijden
    const weekdays: Array<{
      isodow: number;
      naam: string;
      open: string;
      close: string;
      slots: Array<{ from_to: string; uur: number; kwartier: number; omzet_avg: number }>;
    }> = [];

    for (let d = 1; d <= 7; d++) {
      const { openHour, closeHour } = openCloseFor(maand, d);
      const slots: Array<{ from_to: string; uur: number; kwartier: number; omzet_avg: number }> = [];

      for (let h = openHour; h < closeHour; h++) {
        for (let q = 1; q <= 4; q++) {
          const lbl = labelFor(h, q);
          const val = map.get(key(d, h, q)) ?? 0;
          slots.push({ from_to: lbl, uur: h, kwartier: q, omzet_avg: val });
        }
      }

      weekdays.push({
        isodow: d,
        naam: WD_NL[d],
        open: `${PAD(openHour)}:00`,
        close: `${PAD(closeHour)}:00`,
        slots,
      });
    }

    return NextResponse.json({
      ok: true,
      maand,
      maand_naam: [
        "", "januari","februari","maart","april","mei","juni","juli","augustus","september","oktober","november","december"
      ][maand],
      weekdays,
    });
  } catch (err: any) {
    console.error("profiel-overzicht error:", err);
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
