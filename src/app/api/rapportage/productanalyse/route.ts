import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ProductJaarRow = {
  product: string;
  jaar: number;
  aantal: string | number;
};

type TopProductRow = {
  product: string;
  aantal: string | number;
};

type GroeiKrimpRow = {
  product: string;
  aantal_huidig: string | number;
  aantal_vorig: string | number;
};

type VerloopRow = {
  jaar: number;
  maand: number;
  aantal: string | number;
};

type SeizoenRow = {
  product: string;
  jaar: number;
  aantal: string | number;
};

const toInt = (value: string | number | null | undefined) => Number(value || 0);

const isIsoDate = (value: string | null) =>
  !!value && /^\d{4}-\d{2}-\d{2}$/.test(value);

const zelfdePeriodeVorigJaar = (datum: string) => {
  const jaar = Number(datum.slice(0, 4));
  return `${jaar - 1}${datum.slice(4)}`;
};

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    const start = isIsoDate(searchParams.get("start"))
      ? searchParams.get("start")!
      : null;
    const end = isIsoDate(searchParams.get("end")) ? searchParams.get("end")! : null;
    const productFilter = (searchParams.get("product") || "").trim();
    const verloopProduct = (searchParams.get("verloopProduct") || "").trim();

    const where: string[] = [];
    const params: any[] = [];

    if (start) {
      params.push(start);
      where.push(`datum >= $${params.length}::date`);
    }

    if (end) {
      params.push(end);
      where.push(`datum <= $${params.length}::date`);
    }

    if (productFilter) {
      params.push(`%${productFilter}%`);
      where.push(`product ILIKE $${params.length}`);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const jarenResult = await db.query(
      `
        SELECT DISTINCT jaar::int AS jaar
        FROM rapportage.omzet
        ${whereSql}
        ORDER BY jaar::int
      `,
      params
    );

    const perJaarResult = await db.query(
      `
        SELECT
          product,
          jaar::int AS jaar,
          SUM(aantal)::int AS aantal
        FROM rapportage.omzet
        ${whereSql}
        GROUP BY product, jaar
        ORDER BY product, jaar
      `,
      params
    );

    const topResult = await db.query(
      `
        SELECT
          product,
          SUM(aantal)::int AS aantal
        FROM rapportage.omzet
        ${whereSql}
        GROUP BY product
        ORDER BY aantal DESC, product ASC
        LIMIT 50
      `,
      params
    );

    const jaren = jarenResult.rows.map((r: any) => Number(r.jaar));
    const laatsteJaar = jaren.length ? Math.max(...jaren) : new Date().getFullYear();
    const vorigJaar = laatsteJaar - 1;

    const groeiParams: any[] = [];
    const groeiWhere: string[] = [];

    if (productFilter) {
      groeiParams.push(`%${productFilter}%`);
      groeiWhere.push(`product ILIKE $${groeiParams.length}`);
    }

    if (start && end) {
      groeiParams.push(start, end, zelfdePeriodeVorigJaar(start), zelfdePeriodeVorigJaar(end));
      groeiWhere.push(`(
        datum BETWEEN $${groeiParams.length - 3}::date AND $${groeiParams.length - 2}::date
        OR datum BETWEEN $${groeiParams.length - 1}::date AND $${groeiParams.length}::date
      )`);
    } else {
      groeiParams.push(laatsteJaar, vorigJaar);
      groeiWhere.push(`jaar::int IN ($${groeiParams.length - 1}, $${groeiParams.length})`);
    }

    const groeiWhereSql = groeiWhere.length ? `WHERE ${groeiWhere.join(" AND ")}` : "";

    const groeiResult = await db.query(
      `
        SELECT
          product,
          SUM(CASE
            WHEN ${start && end ? `datum BETWEEN $${groeiParams.length - 3}::date AND $${groeiParams.length - 2}::date` : `jaar::int = $${groeiParams.length - 1}`}
            THEN aantal ELSE 0 END)::int AS aantal_huidig,
          SUM(CASE
            WHEN ${start && end ? `datum BETWEEN $${groeiParams.length - 1}::date AND $${groeiParams.length}::date` : `jaar::int = $${groeiParams.length}`}
            THEN aantal ELSE 0 END)::int AS aantal_vorig
        FROM rapportage.omzet
        ${groeiWhereSql}
        GROUP BY product
        HAVING SUM(aantal) > 0
        ORDER BY ABS(
          SUM(CASE
            WHEN ${start && end ? `datum BETWEEN $${groeiParams.length - 3}::date AND $${groeiParams.length - 2}::date` : `jaar::int = $${groeiParams.length - 1}`}
            THEN aantal ELSE 0 END)
          -
          SUM(CASE
            WHEN ${start && end ? `datum BETWEEN $${groeiParams.length - 1}::date AND $${groeiParams.length}::date` : `jaar::int = $${groeiParams.length}`}
            THEN aantal ELSE 0 END)
        ) DESC
        LIMIT 50
      `,
      groeiParams
    );

    const productVoorVerloop = verloopProduct || productFilter || topResult.rows[0]?.product || "";
    const verloopResult = productVoorVerloop
      ? await db.query(
          `
            SELECT
              jaar::int AS jaar,
              maand::int AS maand,
              SUM(aantal)::int AS aantal
            FROM rapportage.omzet
            WHERE product = $1
            GROUP BY jaar, maand
            ORDER BY jaar, maand
          `,
          [productVoorVerloop]
        )
      : { rows: [] };

    const seizoenResult = await db.query(
      `
        WITH jaren AS (
          SELECT DISTINCT jaar::int AS jaar
          FROM rapportage.omzet
        ), peildata AS (
          SELECT
            jaar,
            make_date(jaar, 3, 1) AS start_datum,
            LEAST(
              make_date(jaar, EXTRACT(MONTH FROM CURRENT_DATE)::int, EXTRACT(DAY FROM CURRENT_DATE)::int),
              make_date(jaar, 12, 31)
            ) AS eind_datum
          FROM jaren
        )
        SELECT
          o.product,
          o.jaar::int AS jaar,
          SUM(o.aantal)::int AS aantal
        FROM rapportage.omzet o
        JOIN peildata p ON p.jaar = o.jaar::int
        WHERE o.datum BETWEEN p.start_datum AND p.eind_datum
          ${productFilter ? `AND o.product ILIKE $1` : ""}
        GROUP BY o.product, o.jaar
        ORDER BY o.product, o.jaar
      `,
      productFilter ? [`%${productFilter}%`] : []
    );

    const seizoenJaren = Array.from(
      new Set(seizoenResult.rows.map((r: any) => Number(r.jaar)))
    ).sort((a, b) => a - b);

const productenMap = new Map<string, Record<string, number | string>>();

for (const row of perJaarResult.rows) {
  const item: Record<string, number | string> =
    productenMap.get(row.product) ?? { product: String(row.product) };

  item[`y${row.jaar}`] = toInt(row.aantal);

  productenMap.set(row.product, item);
}

const seizoenMap = new Map<string, Record<string, number | string>>();

for (const row of seizoenResult.rows) {
  let item = seizoenMap.get(String(row.product));

  if (!item) {
    item = {
      product: String(row.product),
    };
  }

  item[String(`y${row.jaar}`)] = toInt(row.aantal);

  seizoenMap.set(String(row.product), item);
}

const jaarTotalen = perJaarResult.rows.reduce<Record<string, number>>(
  (acc, row) => {
    const jaarKey = String(row.jaar);
    acc[jaarKey] = (acc[jaarKey] || 0) + toInt(row.aantal);
    return acc;
  },
  {}
);

    return NextResponse.json({
      success: true,
      filters: {
        start,
        end,
        product: productFilter,
        verloopProduct: productVoorVerloop,
      },
      jaren,
      seizoenJaren,
      jaarTotalen,
      aantallenPerJaarProduct: Array.from(productenMap.values()).sort((a, b) =>
        String(a.product).localeCompare(String(b.product), "nl")
      ),
      topProducten: topResult.rows.map((r) => ({
        product: r.product,
        aantal: toInt(r.aantal),
      })),
      groeiKrimp: groeiResult.rows.map((r) => {
        const huidig = toInt(r.aantal_huidig);
        const vorig = toInt(r.aantal_vorig);
        return {
          product: r.product,
          aantalHuidig: huidig,
          aantalVorig: vorig,
          verschil: huidig - vorig,
          percentage: vorig === 0 ? null : ((huidig - vorig) / vorig) * 100,
        };
      }),
      verloop: {
        product: productVoorVerloop,
        regels: verloopResult.rows.map((r) => ({
          jaar: Number(r.jaar),
          maand: Number(r.maand),
          aantal: toInt(r.aantal),
        })),
      },
      seizoenVergelijking: Array.from(seizoenMap.values()).sort((a, b) =>
        String(a.product).localeCompare(String(b.product), "nl")
      ),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: `Productanalyse kon niet worden opgehaald: ${String(error)}`,
      },
      { status: 500 }
    );
  }
}
