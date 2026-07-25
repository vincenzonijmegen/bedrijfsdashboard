// src/app/api/kassa/kasboekadvies/route.ts

import { NextRequest, NextResponse } from "next/server";
import { query as dbQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

const KASSA_BASE = process.env.KASSA_API_URL!;
const KASSA_USER = process.env.KASSA_USER!;
const KASSA_PASS = process.env.KASSA_PASS!;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

type Classificatie = "laag" | "hoog" | "mpv";

const rondAf = (waarde: number) => Math.round(waarde * 100) / 100;

const normaliseerTekst = (waarde: unknown) =>
  String(waarde ?? "").trim().toLowerCase();

const parseBedrag = (waarde: unknown) => {
  if (waarde == null) return 0;

  const tekst = String(waarde)
    .replace("€", "")
    .replace(/\s/g, "")
    .replace(",", ".");

  const nummer = Number(tekst);
  return Number.isFinite(nummer) ? nummer : 0;
};

const haalVeld = (row: Record<string, unknown>, namen: string[]) => {
  for (const naam of namen) {
    if (row[naam] != null) return row[naam];
  }
  return null;
};

const normalizeDateParam = (dateStr: string) => {
  const parts = dateStr.split("-").map((s) => s.padStart(2, "0"));

  if (parts[0].length === 4) {
    const [y, m, d] = parts;
    return `${d}-${m}-${y}`;
  }

  const [d, m, y] = parts;
  return `${d}-${m}-${y}`;
};

async function fetchKassa(params: string) {
  const url = `${KASSA_BASE}?${params}`;

  const res = await fetch(url, {
    headers: {
      Authorization:
        "Basic " + Buffer.from(`${KASSA_USER}:${KASSA_PASS}`).toString("base64"),
      Accept: "application/json",
    },
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

async function haalProductRubrieken() {
  const result = await dbQuery(`
    SELECT productnaam, rubriek_id
    FROM rapportage.product_rubriek
  `);

  const map = new Map<string, number>();

  for (const row of result.rows) {
    map.set(normaliseerTekst(row.productnaam), Number(row.rubriek_id));
  }

  return map;
}

function bepaalClassificatie(
  product: unknown,
  rubriekId: number | null
): Classificatie {
  const p = normaliseerTekst(product);

  if (
    rubriekId === 30 ||
    p.includes("cadeaubon") ||
    p.includes("cadeaucard")
  ) {
    return "mpv";
  }

  if (
    rubriekId === 31 ||
    p.includes("koeltas") ||
    p.includes("koeltasje") ||
    p.includes("sleutelhanger")
  ) {
    return "hoog";
  }

  return "laag";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startRaw = searchParams.get("start");

  if (!startRaw) {
    return NextResponse.json(
      { success: false, error: 'Parameter "start" ontbreekt' },
      { status: 400 }
    );
  }

  const start = normalizeDateParam(startRaw);

  try {
    const totalenData = await fetchKassa(
      `start=${encodeURIComponent(start)}&totalen=1`
    );

    const record = Array.isArray(totalenData) ? totalenData[0] : totalenData;

    const cash = parseBedrag(record?.Cash);
    const pin = parseBedrag(record?.Pin);
    const bon = parseBedrag(record?.Bon);
    const isvoucher = parseBedrag(record?.isvoucher);

    const detailData = await fetchKassa(
      `start=${encodeURIComponent(start)}&einde=${encodeURIComponent(start)}`
    );

    const detailRegels = Array.isArray(detailData) ? detailData : [];
    const productRubrieken = await haalProductRubrieken();

    let verkopenHoog = 0;
    const onbekendeProducten = new Set<string>();

    for (const regel of detailRegels) {
      const row = regel as Record<string, unknown>;

      const product =
        haalVeld(row, ["Omschrijving", "omschrijving", "Product", "product"]) ??
        "";

      const bedrag = parseBedrag(
        haalVeld(row, [
          "Totaalbedrag",
          "totaalbedrag",
          "Totaal",
          "totaal",
          "Bedrag",
          "bedrag",
        ])
      );

      if (bedrag === 0) continue;

      const productKey = normaliseerTekst(product);
      const rubriekId = productRubrieken.get(productKey) ?? null;

      const classificatie = bepaalClassificatie(product, rubriekId);

      if (!rubriekId && productKey && classificatie === "laag") {
        onbekendeProducten.add(String(product));
      }

      if (classificatie === "hoog") {
        verkopenHoog += bedrag;
      }
    }

    const verkopenLaagRuw = cash - verkopenHoog;
    const waarschuwingen: string[] = [];

    if (verkopenLaagRuw < 0) {
      waarschuwingen.push(
        "Verkopen hoog is groter dan contant. Controleer deze dag handmatig."
      );
    }

    return NextResponse.json({
      datum: start,
      kassa: {
        contant: rondAf(cash),
        pin: rondAf(pin),
        cadeaubon: rondAf(bon),
        totaal: rondAf(cash + pin + bon),
        bonnenVerkocht: rondAf(isvoucher),
      },
      kasboekadvies: {
        verkopenLaag: rondAf(Math.max(verkopenLaagRuw, 0)),
        verkopenHoog: rondAf(verkopenHoog),
        verkoopCadeaubonnen: rondAf(isvoucher),
        ingenomenCadeaubon: rondAf(bon),
      },
      onbekendeProducten: Array.from(onbekendeProducten).sort(),
      waarschuwingen,
    });
  } catch (err: any) {
    console.error("API /api/kassa/kasboekadvies fout:", err);

    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}