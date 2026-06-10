import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ColumnMap = Record<string, string[]>;
type RegelRij = Record<string, any>;

type ProductInfo = {
  id: number;
  naam: string;
  leverancier_naam: string | null;
  label: string;
};

type TotaalItem = {
  naam: string;
  eenheid: string;
  totaal: number;
  bronregels: number;
};

type TussenreceptItem = {
  naam: string;
  eenheid: string;
  benodigde_hoeveelheid: number;
  recept_id: number | null;
  recept_naam: string | null;
  factor: number | null;
  bronregels: number;
  regels: Array<{
    naam: string;
    eenheid: string;
    hoeveelheid_per_recept: number;
    benodigde_hoeveelheid: number;
  }>;
  waarschuwingen: string[];
};

const TABLE_CANDIDATES = [
  "recept_regels",
  "recept_ingredienten",
  "receptuur_regels",
  "receptregels",
  "kostprijs_recept_regels",
  "recepten_ingredienten",
  "recept_ingredienten_regels",
];

const RECEPT_ID_COLUMNS = [
  "recept_id",
  "kostprijs_recept_id",
  "recepten_id",
  "calculatie_recept_id",
];

const INGREDIENT_NAME_COLUMNS = [
  "ingredient_naam",
  "ingredientnaam",
  "ingredient",
  "naam",
  "product_naam",
  "artikel_naam",
  "omschrijving",
  "product",
];

const INGREDIENT_ID_COLUMNS = [
  "ingredient_id",
  "product_id",
  "artikel_id",
  "inkoopartikel_id",
  "leveranciersproduct_id",
  "leveranciers_product_id",
];

const QUANTITY_COLUMNS = [
  "hoeveelheid",
  "gewicht",
  "aantal",
  "gram",
  "hoeveelheid_gram",
  "gram_per_bak",
  "nodig",
];

const UNIT_COLUMNS = ["eenheid", "unit", "maat"];

const YIELD_COLUMNS = [
  "opbrengst_bakken",
  "aantal_bakken",
  "bakken",
  "opbrengst",
  "yield_bakken",
  "recept_opbrengst",
];

// Voor gewone ijsrecepten geldt bij Vincenzo: 1 kostprijsrecept = 1 bak.
// Voor tussenrecepten zoals Melkmix/Vruchtenmix mag dat NIET gelden: die recepten
// leveren liters mix op. Zonder expliciete opbrengst_liter klappen we ze bewust niet open,
// omdat de aantallen anders veel te hoog worden.
const MIX_YIELD_LITER_COLUMNS = [
  "opbrengst_liter",
  "opbrengst_liters",
  "opbrengst_l",
  "aantal_liter",
  "aantal_liters",
  "liter",
  "liters",
  "batch_liter",
  "batch_liters",
];

const TUSSENRECEPT_NAMEN = ["melkmix", "vruchtenmix"];

const q = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

const toNumber = (value: unknown, fallback = 0) => {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
};

const normalizeName = (value: unknown) =>
  String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const firstExisting = (columns: string[], candidates: string[]) =>
  candidates.find((candidate) => columns.includes(candidate));

async function getColumnsForTables(tables: string[]) {
  const result = await db.query(
    `SELECT table_name, column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = ANY($1::text[])
     ORDER BY ordinal_position`,
    [tables]
  );

  const map: ColumnMap = {};
  for (const row of result.rows as { table_name: string; column_name: string }[]) {
    if (!map[row.table_name]) map[row.table_name] = [];
    map[row.table_name].push(row.column_name);
  }
  return map;
}

async function findRecipeLineTable() {
  const columnMap = await getColumnsForTables(TABLE_CANDIDATES);

  for (const tableName of TABLE_CANDIDATES) {
    const columns = columnMap[tableName] || [];
    if (columns.length === 0) continue;

    const receptIdColumn = firstExisting(columns, RECEPT_ID_COLUMNS);
    const quantityColumn = firstExisting(columns, QUANTITY_COLUMNS);
    const nameColumn = firstExisting(columns, INGREDIENT_NAME_COLUMNS);
    const ingredientIdColumn = firstExisting(columns, INGREDIENT_ID_COLUMNS);
    const unitColumn = firstExisting(columns, UNIT_COLUMNS);

    if (receptIdColumn && quantityColumn && (nameColumn || ingredientIdColumn)) {
      return {
        tableName,
        columns,
        receptIdColumn,
        quantityColumn,
        nameColumn: nameColumn || null,
        ingredientIdColumn: ingredientIdColumn || null,
        unitColumn: unitColumn || null,
      };
    }
  }

  return null;
}

function yieldForRecipe(recipeRow: RegelRij | undefined) {
  if (!recipeRow) return { opbrengstBakken: 1, bron: "standaard 1" };

  for (const column of YIELD_COLUMNS) {
    if (Object.prototype.hasOwnProperty.call(recipeRow, column)) {
      const value = toNumber(recipeRow[column], 0);
      if (value > 0) return { opbrengstBakken: value, bron: column };
    }
  }

  return { opbrengstBakken: 1, bron: "standaard 1" };
}


function yieldLiterForMixRecipe(recipeRow: RegelRij | undefined) {
  if (!recipeRow) return { opbrengstLiter: null as number | null, bron: "ontbreekt" };

  for (const column of MIX_YIELD_LITER_COLUMNS) {
    if (Object.prototype.hasOwnProperty.call(recipeRow, column)) {
      const value = toNumber(recipeRow[column], 0);
      if (value > 0) return { opbrengstLiter: value, bron: column };
    }
  }

  return { opbrengstLiter: null as number | null, bron: "niet ingesteld" };
}

async function getProductMap(productIds: number[]) {
  const uniekeIds = Array.from(new Set(productIds.filter((id) => id > 0)));
  if (uniekeIds.length === 0) return new Map<number, ProductInfo>();

  const result = await db.query(
    `SELECT
       p.id,
       p.naam AS product_naam,
       l.naam AS leverancier_naam
     FROM producten p
     LEFT JOIN leveranciers l ON l.id = p.leverancier_id
     WHERE p.id = ANY($1::int[])`,
    [uniekeIds]
  );

  const map = new Map<number, ProductInfo>();
  for (const row of result.rows as { id: number; product_naam: string; leverancier_naam: string | null }[]) {
    const id = toNumber(row.id);
    const leverancier = row.leverancier_naam ? `${row.leverancier_naam} · ` : "";
    map.set(id, {
      id,
      naam: row.product_naam,
      leverancier_naam: row.leverancier_naam,
      label: `${leverancier}${row.product_naam}`,
    });
  }
  return map;
}

function isTussenreceptProduct(product: ProductInfo | null) {
  if (!product) return false;
  const naam = normalizeName(product.naam);
  return TUSSENRECEPT_NAMEN.includes(naam);
}

function addTotaal(
  map: Map<string, TotaalItem>,
  naam: string,
  eenheid: string,
  hoeveelheid: number
) {
  const key = `${naam.toLowerCase()}||${eenheid.toLowerCase()}`;
  const bestaand = map.get(key) || { naam, eenheid, totaal: 0, bronregels: 0 };
  bestaand.totaal += hoeveelheid;
  bestaand.bronregels += 1;
  map.set(key, bestaand);
}

function formatIngredientNaam(
  regel: RegelRij,
  lineTable: NonNullable<Awaited<ReturnType<typeof findRecipeLineTable>>>,
  productMap: Map<number, ProductInfo>
) {
  const ingredientIdColumn = lineTable.ingredientIdColumn;
  const ingredientId = ingredientIdColumn ? toNumber(regel[ingredientIdColumn], 0) : 0;
  const product = ingredientId > 0 ? productMap.get(ingredientId) || null : null;
  const naam =
    product?.label ||
    (lineTable.nameColumn ? String(regel[lineTable.nameColumn] || "").trim() : "") ||
    (ingredientIdColumn && ingredientId > 0 ? `${ingredientIdColumn}: ${ingredientId}` : "Onbekend ingrediënt");
  const eenheid = lineTable.unitColumn ? String(regel[lineTable.unitColumn] || "").trim() : "";

  return { ingredientId, product, naam, eenheid };
}

async function getTussenreceptenByProducten(producten: ProductInfo[]) {
  const namen = Array.from(
    new Set(
      producten
        .filter((product) => isTussenreceptProduct(product))
        .map((product) => normalizeName(product.naam))
    )
  );

  if (namen.length === 0) return new Map<string, RegelRij>();

  const result = await db.query(
    `SELECT *
     FROM recepten
     WHERE lower(trim(naam)) = ANY($1::text[])`,
    [namen]
  );

  const map = new Map<string, RegelRij>();
  for (const row of result.rows as RegelRij[]) {
    map.set(normalizeName(row.naam), row);
  }
  return map;
}

export async function GET(req: NextRequest) {
  const planningId = req.nextUrl.searchParams.get("planning_id");

  if (!planningId) {
    return NextResponse.json({ error: "planning_id ontbreekt" }, { status: 400 });
  }

  try {
    const smakenRes = await db.query(
      `SELECT
         zsp.id AS smaakplanning_id,
         zsp.smaakcode,
         zsp.smaaknaam,
         zsp.soort,
         zsp.aantal_bakken,
         zsp.recept_id AS keuken_recept_id,
         rk.kostprijs_recept_id,
         rk.status AS koppeling_status,
         kr.naam AS kostprijs_recept_naam
       FROM zomerfeesten_smaakplanning zsp
       LEFT JOIN recept_koppelingen rk ON rk.keuken_recept_id = zsp.recept_id
       LEFT JOIN recepten kr ON kr.id = rk.kostprijs_recept_id
       WHERE zsp.planning_id = $1
       ORDER BY zsp.sortering NULLS LAST, zsp.soort, zsp.smaaknaam`,
      [planningId]
    );

    const smaken = smakenRes.rows as RegelRij[];
    const doorrekenbareSmaken = smaken.filter(
      (s) =>
        s.kostprijs_recept_id &&
        !["ontbreekt_kostprijs", "controle_nodig", "overslaan"].includes(
          String(s.koppeling_status || "")
        )
    );

    const kostprijsReceptIds = Array.from(
      new Set(
        doorrekenbareSmaken
          .map((s) => toNumber(s.kostprijs_recept_id, 0))
          .filter((id) => id > 0)
      )
    );

    if (kostprijsReceptIds.length === 0) {
      return NextResponse.json({
        success: true,
        meta: {
          line_table: null,
          waarschuwingen: ["Er zijn nog geen doorrekenbare smaken in deze planning."],
        },
        smaken: [],
        tussenrecepten: [],
        totalen: [],
      });
    }

    const receptenRes = await db.query(
      `SELECT * FROM recepten WHERE id = ANY($1::int[])`,
      [kostprijsReceptIds]
    );
    const receptRows = new Map<number, RegelRij>();
    for (const row of receptenRes.rows as RegelRij[]) {
      receptRows.set(toNumber(row.id), row);
    }

    const lineTable = await findRecipeLineTable();
    if (!lineTable) {
      return NextResponse.json({
        success: true,
        meta: {
          line_table: null,
          waarschuwingen: [
            "Geen herkenbare kostprijs-receptregeltabel gevonden. Verwachte tabelnamen zijn bijvoorbeeld recept_regels of recept_ingredienten.",
          ],
        },
        smaken: doorrekenbareSmaken.map((s) => ({
          smaakplanning_id: s.smaakplanning_id,
          smaakcode: s.smaakcode,
          smaaknaam: s.smaaknaam,
          aantal_bakken: toNumber(s.aantal_bakken),
          kostprijs_recept_id: toNumber(s.kostprijs_recept_id),
          kostprijs_recept_naam: s.kostprijs_recept_naam,
          opbrengst_bakken: 1,
          opbrengst_bron: "niet bepaald",
          factor: toNumber(s.aantal_bakken),
          regels: [],
          waarschuwingen: ["Receptregels konden nog niet worden gevonden."],
        })),
        tussenrecepten: [],
        totalen: [],
      });
    }

    const regelsRes = await db.query(
      `SELECT *
       FROM ${q(lineTable.tableName)}
       WHERE ${q(lineTable.receptIdColumn)} = ANY($1::int[])`,
      [kostprijsReceptIds]
    );

    const regelsPerRecept = new Map<number, RegelRij[]>();
    for (const row of regelsRes.rows as RegelRij[]) {
      const receptId = toNumber(row[lineTable.receptIdColumn], 0);
      if (!regelsPerRecept.has(receptId)) regelsPerRecept.set(receptId, []);
      regelsPerRecept.get(receptId)?.push(row);
    }

    const eersteProductIds = lineTable.ingredientIdColumn
      ? (regelsRes.rows as RegelRij[]).map((row) => toNumber(row[lineTable.ingredientIdColumn as string], 0))
      : [];
    let productMap = await getProductMap(eersteProductIds);

    const tussenProducten = Array.from(productMap.values()).filter((product) =>
      isTussenreceptProduct(product)
    );
    const tussenReceptMap = await getTussenreceptenByProducten(tussenProducten);
    const tussenReceptIds = Array.from(
      new Set(
        Array.from(tussenReceptMap.values())
          .map((row) => toNumber(row.id, 0))
          .filter((id) => id > 0)
      )
    );

    const tussenRegelsPerRecept = new Map<number, RegelRij[]>();
    if (tussenReceptIds.length > 0) {
      const tussenRegelsRes = await db.query(
        `SELECT *
         FROM ${q(lineTable.tableName)}
         WHERE ${q(lineTable.receptIdColumn)} = ANY($1::int[])`,
        [tussenReceptIds]
      );

      const extraProductIds = lineTable.ingredientIdColumn
        ? (tussenRegelsRes.rows as RegelRij[]).map((row) => toNumber(row[lineTable.ingredientIdColumn as string], 0))
        : [];
      const extraProductMap = await getProductMap(extraProductIds);
      productMap = new Map([...Array.from(productMap.entries()), ...Array.from(extraProductMap.entries())]);

      for (const row of tussenRegelsRes.rows as RegelRij[]) {
        const receptId = toNumber(row[lineTable.receptIdColumn], 0);
        if (!tussenRegelsPerRecept.has(receptId)) tussenRegelsPerRecept.set(receptId, []);
        tussenRegelsPerRecept.get(receptId)?.push(row);
      }
    }

    const totalenMap = new Map<string, TotaalItem>();
    const tussenMap = new Map<string, TussenreceptItem>();

    function verwerkTussenrecept(
      product: ProductInfo,
      eenheid: string,
      benodigdeHoeveelheid: number
    ) {
      const naamKey = normalizeName(product.naam);
      const recept = tussenReceptMap.get(naamKey) || null;
      const key = `${naamKey}||${eenheid.toLowerCase()}`;
      const bestaand = tussenMap.get(key) || {
        naam: product.naam,
        eenheid,
        benodigde_hoeveelheid: 0,
        recept_id: recept ? toNumber(recept.id, 0) : null,
        recept_naam: recept ? String(recept.naam || product.naam) : null,
        factor: null,
        bronregels: 0,
        regels: [],
        waarschuwingen: [],
      };

      bestaand.benodigde_hoeveelheid += benodigdeHoeveelheid;
      bestaand.bronregels += 1;
      tussenMap.set(key, bestaand);
    }

    const controleSmaken = doorrekenbareSmaken.map((s) => {
      const kostprijsReceptId = toNumber(s.kostprijs_recept_id);
      const aantalBakken = toNumber(s.aantal_bakken);
      const { opbrengstBakken, bron } = yieldForRecipe(receptRows.get(kostprijsReceptId));
      const factor = opbrengstBakken > 0 ? aantalBakken / opbrengstBakken : aantalBakken;
      const receptRegels = regelsPerRecept.get(kostprijsReceptId) || [];

      const regels = receptRegels.map((regel) => {
        const { product, naam, eenheid } = formatIngredientNaam(regel, lineTable, productMap);
        const hoeveelheidPerRecept = toNumber(regel[lineTable.quantityColumn]);
        const benodigdeHoeveelheid = hoeveelheidPerRecept * factor;
        const type = product && isTussenreceptProduct(product) ? "tussenrecept" : "product";

        if (type === "tussenrecept" && product) {
          verwerkTussenrecept(product, eenheid, benodigdeHoeveelheid);
        } else {
          addTotaal(totalenMap, naam, eenheid, benodigdeHoeveelheid);
        }

        return {
          naam,
          eenheid,
          hoeveelheid_per_recept: hoeveelheidPerRecept,
          benodigde_hoeveelheid: benodigdeHoeveelheid,
          type,
        };
      });

      const waarschuwingen: string[] = [];
      if (regels.length === 0) {
        waarschuwingen.push("Geen receptregels gevonden voor dit kostprijsrecept.");
      }

      return {
        smaakplanning_id: s.smaakplanning_id,
        smaakcode: s.smaakcode,
        smaaknaam: s.smaaknaam,
        aantal_bakken: aantalBakken,
        kostprijs_recept_id: kostprijsReceptId,
        kostprijs_recept_naam: s.kostprijs_recept_naam,
        opbrengst_bakken: opbrengstBakken,
        opbrengst_bron: bron,
        factor,
        regels,
        waarschuwingen,
      };
    });

    for (const tussen of tussenMap.values()) {
      if (!tussen.recept_id) {
        tussen.waarschuwingen.push(
          `Geen kostprijsrecept gevonden voor tussenrecept ${tussen.naam}. Deze hoeveelheid blijft daarom niet-opengeklapt.`
        );
        addTotaal(totalenMap, `Vincenzo · ${tussen.naam}`, tussen.eenheid, tussen.benodigde_hoeveelheid);
        continue;
      }

      const receptRow = tussenReceptMap.get(normalizeName(tussen.naam));
      const { opbrengstLiter, bron } = yieldLiterForMixRecipe(receptRow);

      if (!opbrengstLiter || opbrengstLiter <= 0) {
        tussen.waarschuwingen.push(
          `${tussen.naam} is een tussenrecept, maar op het kostprijsrecept staat nog geen opbrengst_liter. Daarom is dit tussenrecept niet opengeklapt.`
        );
        tussen.factor = null;
        addTotaal(totalenMap, `Vincenzo · ${tussen.naam}`, tussen.eenheid, tussen.benodigde_hoeveelheid);
        continue;
      }

      const factor = tussen.benodigde_hoeveelheid / opbrengstLiter;
      tussen.factor = factor;

      const tussenRegels = tussenRegelsPerRecept.get(tussen.recept_id) || [];
      if (tussenRegels.length === 0) {
        tussen.waarschuwingen.push(`Geen receptregels gevonden voor tussenrecept ${tussen.naam}.`);
        addTotaal(totalenMap, `Vincenzo · ${tussen.naam}`, tussen.eenheid, tussen.benodigde_hoeveelheid);
        continue;
      }

      tussen.regels = tussenRegels.map((regel) => {
        const { naam, eenheid } = formatIngredientNaam(regel, lineTable, productMap);
        const hoeveelheidPerRecept = toNumber(regel[lineTable.quantityColumn]);
        const benodigdeHoeveelheid = hoeveelheidPerRecept * factor;
        addTotaal(totalenMap, naam, eenheid, benodigdeHoeveelheid);
        return {
          naam,
          eenheid,
          hoeveelheid_per_recept: hoeveelheidPerRecept,
          benodigde_hoeveelheid: benodigdeHoeveelheid,
        };
      });
    }

    const totalen = Array.from(totalenMap.values()).sort((a, b) =>
      a.naam.localeCompare(b.naam, "nl")
    );
    const tussenrecepten = Array.from(tussenMap.values()).sort((a, b) =>
      a.naam.localeCompare(b.naam, "nl")
    );

    return NextResponse.json({
      success: true,
      meta: {
        line_table: lineTable.tableName,
        recept_id_column: lineTable.receptIdColumn,
        quantity_column: lineTable.quantityColumn,
        name_column: lineTable.nameColumn,
        ingredient_id_column: lineTable.ingredientIdColumn,
        productnamen_gekoppeld: lineTable.ingredientIdColumn ? true : false,
        unit_column: lineTable.unitColumn,
        tussenrecepten_opengeklapt: tussenrecepten.filter((t) => t.regels.length > 0).length,
        waarschuwingen: tussenrecepten.flatMap((t) => t.waarschuwingen),
      },
      smaken: controleSmaken,
      tussenrecepten,
      totalen,
    });
  } catch (err) {
    console.error("Fout bij Zomerfeesten ingrediëntencontrole:", err);
    return NextResponse.json({ error: "Databasefout" }, { status: 500 });
  }
}
