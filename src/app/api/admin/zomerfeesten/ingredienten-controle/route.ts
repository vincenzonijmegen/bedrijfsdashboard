import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ColumnMap = Record<string, string[]>;

type RegelRij = Record<string, any>;

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

const q = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`;

const toNumber = (value: unknown, fallback = 0) => {
  if (value === null || value === undefined || value === "") return fallback;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
};

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
  if (!recipeRow) return { opbrengstBakken: 1, bron: "standaard 1 bak" };

  for (const column of YIELD_COLUMNS) {
    if (Object.prototype.hasOwnProperty.call(recipeRow, column)) {
      const value = toNumber(recipeRow[column], 0);
      if (value > 0) return { opbrengstBakken: value, bron: column };
    }
  }

  return { opbrengstBakken: 1, bron: "standaard 1 bak" };
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

    const totalenMap = new Map<
      string,
      { naam: string; eenheid: string; totaal: number; bronregels: number }
    >();

    const controleSmaken = doorrekenbareSmaken.map((s) => {
      const kostprijsReceptId = toNumber(s.kostprijs_recept_id);
      const aantalBakken = toNumber(s.aantal_bakken);
      const { opbrengstBakken, bron } = yieldForRecipe(receptRows.get(kostprijsReceptId));
      const factor = opbrengstBakken > 0 ? aantalBakken / opbrengstBakken : aantalBakken;
      const receptRegels = regelsPerRecept.get(kostprijsReceptId) || [];

      const regels = receptRegels.map((regel) => {
        const ingredientIdColumn = lineTable.ingredientIdColumn;
        const naam = lineTable.nameColumn
          ? String(regel[lineTable.nameColumn] || "").trim()
          : ingredientIdColumn
            ? `${ingredientIdColumn}: ${regel[ingredientIdColumn]}`
            : "Onbekend ingrediënt";
        const eenheid = lineTable.unitColumn
          ? String(regel[lineTable.unitColumn] || "").trim()
          : "";
        const hoeveelheidPerRecept = toNumber(regel[lineTable.quantityColumn]);
        const benodigdeHoeveelheid = hoeveelheidPerRecept * factor;
        const key = `${naam.toLowerCase()}||${eenheid.toLowerCase()}`;

        const bestaand = totalenMap.get(key) || {
          naam,
          eenheid,
          totaal: 0,
          bronregels: 0,
        };
        bestaand.totaal += benodigdeHoeveelheid;
        bestaand.bronregels += 1;
        totalenMap.set(key, bestaand);

        return {
          naam,
          eenheid,
          hoeveelheid_per_recept: hoeveelheidPerRecept,
          benodigde_hoeveelheid: benodigdeHoeveelheid,
        };
      });

      const waarschuwingen: string[] = [];
      if (bron === "standaard 1 bak") {
        waarschuwingen.push(
          "Geen opbrengst/aantal bakken gevonden op het kostprijsrecept; gerekend alsof het recept 1 bak oplevert."
        );
      }
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

    const totalen = Array.from(totalenMap.values()).sort((a, b) =>
      a.naam.localeCompare(b.naam, "nl")
    );

    return NextResponse.json({
      success: true,
      meta: {
        line_table: lineTable.tableName,
        recept_id_column: lineTable.receptIdColumn,
        quantity_column: lineTable.quantityColumn,
        name_column: lineTable.nameColumn,
        unit_column: lineTable.unitColumn,
        waarschuwingen: [],
      },
      smaken: controleSmaken,
      totalen,
    });
  } catch (err) {
    console.error("Fout bij Zomerfeesten ingrediëntencontrole:", err);
    return NextResponse.json({ error: "Databasefout" }, { status: 500 });
  }
}
