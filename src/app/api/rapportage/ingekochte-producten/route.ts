import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyJWT } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOEGESTANE_ROLLEN = ["beheerder", "accountant"];

type BestelregelDb = {
  bestelling_id: number | string;
  besteld_op: string;
  referentie: string | null;
  leverancier_id: number | string;
  leverancier_naam: string;
  product_id: number | string | null;
  product_sleutel: string;
  product_naam: string;
  bestelnummer: string | null;
  aantal: number | string;
};

type Bestelregel = {
  bestellingId: number;
  besteldOp: string;
  referentie: string;
  leverancierId: number;
  leverancierNaam: string;
  productId: number | null;
  productSleutel: string;
  productNaam: string;
  bestelnummer: string | null;
  aantal: number;
};

type ProductTotaalIntern = {
  leverancierId: number;
  leverancierNaam: string;
  productId: number | null;
  productSleutel: string;
  productNaam: string;
  bestelnummer: string | null;
  totaalAantal: number;
  bestellingen: Set<number>;
};

type LeverancierTotaalIntern = {
  leverancierId: number;
  leverancierNaam: string;
  aantalRegels: number;
  bestellingen: Set<number>;
  producten: Set<string>;
};

type MaandTotaalIntern = {
  maand: string;
  aantalRegels: number;
  bestellingen: Set<number>;
  leveranciers: Set<number>;
  producten: Set<string>;
};

async function magLezen(req: NextRequest) {
  try {
    const gebruikerJWT = verifyJWT(req);
    const result = await db.query(
      `SELECT rol
       FROM medewerkers
       WHERE lower(email) = lower($1)
       LIMIT 1`,
      [gebruikerJWT.email]
    );

    const rol = String(result.rows[0]?.rol || "").toLowerCase();
    return TOEGESTANE_ROLLEN.includes(rol);
  } catch {
    return false;
  }
}

function isGeldigeIsoDatum(value: string | null) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const [jaar, maand, dag] = value.split("-").map(Number);
  const datum = new Date(Date.UTC(jaar, maand - 1, dag));

  return (
    datum.getUTCFullYear() === jaar &&
    datum.getUTCMonth() === maand - 1 &&
    datum.getUTCDate() === dag
  );
}

function leesOptioneelId(value: string | null) {
  if (!value) return null;
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : NaN;
}

function productSleutel(regel: Bestelregel) {
  return regel.productId === null
    ? `onbekend:${regel.productSleutel}`
    : String(regel.productId);
}

export async function GET(req: NextRequest) {
  if (!(await magLezen(req))) {
    return NextResponse.json({ error: "Geen toegang" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const vanParameter = searchParams.get("van");
  const totParameter = searchParams.get("tot");

  if (vanParameter && !isGeldigeIsoDatum(vanParameter)) {
    return NextResponse.json(
      { error: "Ongeldige begindatum" },
      { status: 400 }
    );
  }

  if (totParameter && !isGeldigeIsoDatum(totParameter)) {
    return NextResponse.json(
      { error: "Ongeldige einddatum" },
      { status: 400 }
    );
  }

  if (vanParameter && totParameter && vanParameter > totParameter) {
    return NextResponse.json(
      { error: "De begindatum ligt na de einddatum" },
      { status: 400 }
    );
  }

  const leverancierId = leesOptioneelId(searchParams.get("leverancier"));
  const productId = leesOptioneelId(searchParams.get("product"));

  if (Number.isNaN(leverancierId)) {
    return NextResponse.json(
      { error: "Ongeldige leverancier" },
      { status: 400 }
    );
  }

  if (Number.isNaN(productId)) {
    return NextResponse.json(
      { error: "Ongeldig product" },
      { status: 400 }
    );
  }

  try {
    const [regelsResultaat, leveranciersResultaat, productenResultaat] =
      await Promise.all([
        db.query(
          `WITH bestelregels AS (
             SELECT
               b.id AS bestelling_id,
               b.besteld_op::date::text AS besteld_op,
               b.referentie,
               b.leverancier_id,
               COALESCE(l.naam, 'Onbekende leverancier') AS leverancier_naam,
               item.key AS product_sleutel,
               CASE
                 WHEN item.key ~ '^[0-9]+$' THEN item.key::int
                 ELSE NULL
               END AS product_id,
               CASE
                 WHEN item.value ~ '^[0-9]+([.][0-9]+)?$'
                   THEN item.value::numeric
                 ELSE 0::numeric
               END AS aantal
             FROM bestellingen b
             LEFT JOIN leveranciers l ON l.id = b.leverancier_id
             CROSS JOIN LATERAL jsonb_each_text(
               CASE
                 WHEN jsonb_typeof(COALESCE(b.data::jsonb, '{}'::jsonb)) = 'object'
                   THEN COALESCE(b.data::jsonb, '{}'::jsonb)
                 ELSE '{}'::jsonb
               END
             ) AS item(key, value)
             WHERE ($1::date IS NULL OR b.besteld_op >= $1::date)
               AND ($2::date IS NULL OR b.besteld_op < $2::date + INTERVAL '1 day')
               AND ($3::int IS NULL OR b.leverancier_id = $3::int)
           )
           SELECT
             br.bestelling_id,
             br.besteld_op,
             br.referentie,
             br.leverancier_id,
             br.leverancier_naam,
             br.product_id,
             br.product_sleutel,
             COALESCE(
               p.naam,
               'Onbekend product (' || br.product_sleutel || ')'
             ) AS product_naam,
             p.bestelnummer,
             br.aantal
           FROM bestelregels br
           LEFT JOIN producten p ON p.id = br.product_id
           WHERE br.aantal > 0
             AND ($4::int IS NULL OR br.product_id = $4::int)
           ORDER BY br.besteld_op DESC,
                    br.bestelling_id DESC,
                    br.leverancier_naam,
                    product_naam`,
          [vanParameter, totParameter, leverancierId, productId]
        ),
        db.query(
          `SELECT id, naam, soort
           FROM leveranciers
           ORDER BY naam`
        ),
        db.query(
          `SELECT
             p.id,
             p.naam,
             p.leverancier_id,
             l.naam AS leverancier_naam,
             p.bestelnummer,
             p.actief
           FROM producten p
           LEFT JOIN leveranciers l ON l.id = p.leverancier_id
           ORDER BY l.naam NULLS LAST, p.naam`
        ),
      ]);

    const regels: Bestelregel[] = (regelsResultaat.rows as BestelregelDb[]).map(
      (row) => ({
        bestellingId: Number(row.bestelling_id),
        besteldOp: row.besteld_op,
        referentie: row.referentie || "-",
        leverancierId: Number(row.leverancier_id),
        leverancierNaam: row.leverancier_naam,
        productId: row.product_id === null ? null : Number(row.product_id),
        productSleutel: row.product_sleutel,
        productNaam: row.product_naam,
        bestelnummer: row.bestelnummer,
        aantal: Number(row.aantal),
      })
    );

    const productMap = new Map<string, ProductTotaalIntern>();
    const leverancierMap = new Map<number, LeverancierTotaalIntern>();
    const maandMap = new Map<string, MaandTotaalIntern>();

    const bestellingIds = new Set<number>();
    const leverancierIds = new Set<number>();
    const productSleutels = new Set<string>();

    for (const regel of regels) {
      const pSleutel = productSleutel(regel);
      const productMapSleutel = `${regel.leverancierId}:${pSleutel}`;
      const maand = regel.besteldOp.slice(0, 7);

      bestellingIds.add(regel.bestellingId);
      leverancierIds.add(regel.leverancierId);
      productSleutels.add(pSleutel);

      const bestaandProduct = productMap.get(productMapSleutel) ?? {
        leverancierId: regel.leverancierId,
        leverancierNaam: regel.leverancierNaam,
        productId: regel.productId,
        productSleutel: regel.productSleutel,
        productNaam: regel.productNaam,
        bestelnummer: regel.bestelnummer,
        totaalAantal: 0,
        bestellingen: new Set<number>(),
      };

      bestaandProduct.totaalAantal += regel.aantal;
      bestaandProduct.bestellingen.add(regel.bestellingId);
      productMap.set(productMapSleutel, bestaandProduct);

      const bestaandeLeverancier = leverancierMap.get(regel.leverancierId) ?? {
        leverancierId: regel.leverancierId,
        leverancierNaam: regel.leverancierNaam,
        aantalRegels: 0,
        bestellingen: new Set<number>(),
        producten: new Set<string>(),
      };

      bestaandeLeverancier.aantalRegels += 1;
      bestaandeLeverancier.bestellingen.add(regel.bestellingId);
      bestaandeLeverancier.producten.add(pSleutel);
      leverancierMap.set(regel.leverancierId, bestaandeLeverancier);

      const bestaandeMaand = maandMap.get(maand) ?? {
        maand,
        aantalRegels: 0,
        bestellingen: new Set<number>(),
        leveranciers: new Set<number>(),
        producten: new Set<string>(),
      };

      bestaandeMaand.aantalRegels += 1;
      bestaandeMaand.bestellingen.add(regel.bestellingId);
      bestaandeMaand.leveranciers.add(regel.leverancierId);
      bestaandeMaand.producten.add(pSleutel);
      maandMap.set(maand, bestaandeMaand);
    }

    const perProduct = Array.from(productMap.values())
      .map((item) => ({
        leverancierId: item.leverancierId,
        leverancierNaam: item.leverancierNaam,
        productId: item.productId,
        productSleutel: item.productSleutel,
        productNaam: item.productNaam,
        bestelnummer: item.bestelnummer,
        aantalBestellingen: item.bestellingen.size,
        totaalAantal: item.totaalAantal,
      }))
      .sort(
        (a, b) =>
          a.leverancierNaam.localeCompare(b.leverancierNaam, "nl") ||
          a.productNaam.localeCompare(b.productNaam, "nl")
      );

    const perLeverancier = Array.from(leverancierMap.values())
      .map((item) => ({
        leverancierId: item.leverancierId,
        leverancierNaam: item.leverancierNaam,
        aantalBestellingen: item.bestellingen.size,
        aantalProducten: item.producten.size,
        aantalRegels: item.aantalRegels,
      }))
      .sort((a, b) =>
        a.leverancierNaam.localeCompare(b.leverancierNaam, "nl")
      );

    const perMaand = Array.from(maandMap.values())
      .map((item) => ({
        maand: item.maand,
        aantalBestellingen: item.bestellingen.size,
        aantalLeveranciers: item.leveranciers.size,
        aantalProducten: item.producten.size,
        aantalRegels: item.aantalRegels,
      }))
      .sort((a, b) => a.maand.localeCompare(b.maand));

    return NextResponse.json({
      success: true,
      filters: {
        van: vanParameter,
        tot: totParameter,
        leverancierId,
        productId,
      },
      samenvatting: {
        aantalBestellingen: bestellingIds.size,
        aantalLeveranciers: leverancierIds.size,
        aantalProducten: productSleutels.size,
        aantalRegels: regels.length,
      },
      perProduct,
      perLeverancier,
      perMaand,
      regels,
      opties: {
        leveranciers: leveranciersResultaat.rows.map((row) => ({
          id: Number(row.id),
          naam: row.naam,
          soort: row.soort,
        })),
        producten: productenResultaat.rows.map((row) => ({
          id: Number(row.id),
          naam: row.naam,
          leverancierId: Number(row.leverancier_id),
          leverancierNaam: row.leverancier_naam,
          bestelnummer: row.bestelnummer,
          actief: row.actief !== false,
        })),
      },
    });
  } catch (error) {
    console.error("Fout bij rapportage ingekochte producten:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Rapportage ingekochte producten kon niet worden geladen.",
      },
      { status: 500 }
    );
  }
}
