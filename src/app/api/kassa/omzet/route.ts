// src/app/api/kassa/omzet/route.ts

import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { query as dbQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

const KASSA_BASE = process.env.KASSA_API_URL!;
const KASSA_USER = process.env.KASSA_USER!;
const KASSA_PASS = process.env.KASSA_PASS!;

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

type ProductRubriek = {
  productnaam: string;
  rubriek_id: number;
};

type Classificatie = "laag" | "hoog" | "mpv";

const rondAf = (waarde: number) => Math.round(waarde * 100) / 100;

const normaliseerTekst = (waarde: unknown) =>
  String(waarde ?? "")
    .trim()
    .toLowerCase();

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

// Normalizeer DD-MM-YYYY of ISO YYYY-MM-DD naar DD-MM-YYYY voor kassa-API
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

  console.log("Fetch Kassa URL:", url);

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

  for (const row of result.rows as ProductRubriek[]) {
    map.set(normaliseerTekst(row.productnaam), Number(row.rubriek_id));
  }

  return map;
}

function bepaalClassificatie(product: unknown, rubriekId: number | null): Classificatie {
  const productTekst = normaliseerTekst(product);

  if (
    rubriekId === 30 ||
    productTekst.includes("cadeaubon") ||
    productTekst.includes("cadeaucard")
  ) {
    return "mpv";
  }

  if (
    rubriekId === 31 ||
    productTekst.includes("koeltas") ||
    productTekst.includes("koeltasje") ||
    productTekst.includes("sleutelhanger")
  ) {
    return "hoog";
  }

  return "laag";
}

async function berekenBtwSplitsingVoorDag(start: string) {
  const detailData = await fetchKassa(
    `start=${encodeURIComponent(start)}&einde=${encodeURIComponent(start)}`
  );

  const regels = Array.isArray(detailData) ? detailData : [];
  const productRubrieken = await haalProductRubrieken();

  let omzetLaag = 0;
  let omzetHoog = 0;
  let verkoopCadeaubonnen = 0;

  const onbekendeProducten = new Set<string>();

  for (const regel of regels) {
    const row = regel as Record<string, unknown>;

    const product =
      haalVeld(row, ["Omschrijving", "omschrijving", "Product", "product"]) ?? "";

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

    if (!rubriekId && productKey) {
      onbekendeProducten.add(String(product));
    }

    const classificatie = bepaalClassificatie(product, rubriekId);

    if (classificatie === "mpv") {
      verkoopCadeaubonnen += bedrag;
    } else if (classificatie === "hoog") {
      omzetHoog += bedrag;
    } else {
      omzetLaag += bedrag;
    }
  }

  return {
    omzetLaag: rondAf(omzetLaag),
    omzetHoog: rondAf(omzetHoog),
    verkoopCadeaubonnen: rondAf(verkoopCadeaubonnen),
    onbekendeProducten: Array.from(onbekendeProducten).sort(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const startRaw = searchParams.get("start");
  const totalen = searchParams.get("totalen");

  console.log("API GET kassa/omzet params:", { startRaw, totalen });

  if (!startRaw) {
    return NextResponse.json(
      { success: false, error: 'Parameter "start" ontbreekt' },
      { status: 400 }
    );
  }

  const start = normalizeDateParam(startRaw);

  try {
    if (totalen) {
      const data = await fetchKassa(
        `start=${encodeURIComponent(start)}&totalen=1`
      );

      const btwSplitsing = await berekenBtwSplitsingVoorDag(start);

      if (Array.isArray(data)) {
        return NextResponse.json(
          data.map((record, index) =>
            index === 0
              ? {
                  ...record,
                  omzetLaag: btwSplitsing.omzetLaag,
                  omzetHoog: btwSplitsing.omzetHoog,
                  verkoopCadeaubonnen: btwSplitsing.verkoopCadeaubonnen,
                  onbekendeProducten: btwSplitsing.onbekendeProducten,
                }
              : record
          )
        );
      }

      return NextResponse.json({
        ...data,
        omzetLaag: btwSplitsing.omzetLaag,
        omzetHoog: btwSplitsing.omzetHoog,
        verkoopCadeaubonnen: btwSplitsing.verkoopCadeaubonnen,
        onbekendeProducten: btwSplitsing.onbekendeProducten,
      });
    }

    const eindeRaw = searchParams.get("einde");

    if (!eindeRaw) {
      return NextResponse.json(
        { success: false, error: 'Parameter "einde" ontbreekt' },
        { status: 400 }
      );
    }

    const einde = normalizeDateParam(eindeRaw);

    const data = await fetchKassa(
      `start=${encodeURIComponent(start)}&einde=${encodeURIComponent(einde)}`
    );

    return NextResponse.json(data);
  } catch (err: any) {
    console.error("API /api/kassa/omzet fout:", err);

    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}