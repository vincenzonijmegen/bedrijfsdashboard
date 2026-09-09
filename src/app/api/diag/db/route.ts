import { NextResponse } from "next/server";
import { dbRapportage } from "@/lib/dbRapportage";

function maskConnStr(cs?: string) {
  if (!cs) return "";
  try {
    const u = new URL(cs);
    const user = u.username || "";
    const host = u.hostname || "";
    const db = u.pathname?.slice(1) || "";
    const port = u.port || "";
    return `postgres://${user ? user : "?"}:****@${host}${port ? ":" + port : ""}/${db}`;
  } catch {
    return "unparseable-connection-string";
  }
}

const CASHFLOW_BRONNEN = [
  { schema: "rapportage", table: "omzet" },
  { schema: "rapportage", table: "loonkosten" },
  { schema: "public", table: "bestellingen" },
  { schema: "public", table: "leveranciers" },
  { schema: "public", table: "producten" },
  { schema: "public", table: "mypos_transactions" },
  { schema: "public", table: "kasboek_dagen" },
  { schema: "public", table: "kasboek_transacties" },
] as const;

export async function GET() {
  try {
    const picked = process.env.POSTGRES_URL
      ? "POSTGRES_URL"
      : process.env.DATABASE_URL
        ? "DATABASE_URL"
        : "NONE";
    const conn = process.env.POSTGRES_URL || process.env.DATABASE_URL || "";

    // Basisinfo uit de database waar deze API daadwerkelijk mee praat.
    // to_regclass voorkomt fouten als een object niet bestaat.
    const meta = await dbRapportage.query(`
      SELECT current_database() AS db,
             current_user AS usr,
             to_regclass('rapportage.omzet') IS NOT NULL AS raw_exists,
             to_regclass('rapportage.omzet_maand') IS NOT NULL AS mv_exists,
             CASE
               WHEN to_regclass('rapportage.omzet') IS NOT NULL
               THEN (SELECT COUNT(*)::int FROM rapportage.omzet)
               ELSE NULL
             END AS raw_count,
             CASE
               WHEN to_regclass('rapportage.omzet_maand') IS NOT NULL
               THEN (SELECT COUNT(*)::int FROM rapportage.omzet_maand)
               ELSE NULL
             END AS mv_count,
             CASE
               WHEN to_regclass('rapportage.omzet') IS NOT NULL
               THEN (SELECT MAX(datum) FROM rapportage.omzet)
               ELSE NULL
             END AS raw_max
    `);

    const schemaNamen = [...new Set(CASHFLOW_BRONNEN.map((b) => b.schema))];
    const tabelNamen = CASHFLOW_BRONNEN.map((b) => b.table);

    const columns = await dbRapportage.query(
      `
        SELECT
          c.table_schema,
          c.table_name,
          c.ordinal_position,
          c.column_name,
          c.data_type,
          c.udt_name,
          c.is_nullable,
          c.column_default
        FROM information_schema.columns c
        WHERE c.table_schema = ANY($1::text[])
          AND c.table_name = ANY($2::text[])
        ORDER BY c.table_schema, c.table_name, c.ordinal_position
      `,
      [schemaNamen, tabelNamen]
    );

    const constraints = await dbRapportage.query(
      `
        SELECT
          ns.nspname AS table_schema,
          tbl.relname AS table_name,
          con.conname AS constraint_name,
          CASE con.contype
            WHEN 'p' THEN 'PRIMARY KEY'
            WHEN 'u' THEN 'UNIQUE'
            WHEN 'f' THEN 'FOREIGN KEY'
            WHEN 'c' THEN 'CHECK'
            WHEN 'x' THEN 'EXCLUSION'
            ELSE con.contype::text
          END AS constraint_type,
          pg_get_constraintdef(con.oid, true) AS definition
        FROM pg_constraint con
        JOIN pg_class tbl ON tbl.oid = con.conrelid
        JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
        WHERE ns.nspname = ANY($1::text[])
          AND tbl.relname = ANY($2::text[])
        ORDER BY ns.nspname, tbl.relname, con.conname
      `,
      [schemaNamen, tabelNamen]
    );

    const indexes = await dbRapportage.query(
      `
        SELECT
          schemaname AS table_schema,
          tablename AS table_name,
          indexname AS index_name,
          indexdef AS definition
        FROM pg_indexes
        WHERE schemaname = ANY($1::text[])
          AND tablename = ANY($2::text[])
        ORDER BY schemaname, tablename, indexname
      `,
      [schemaNamen, tabelNamen]
    );

    const existing = await dbRapportage.query(
      `
        SELECT
          n.nspname AS table_schema,
          c.relname AS table_name,
          CASE c.relkind
            WHEN 'r' THEN 'table'
            WHEN 'p' THEN 'partitioned table'
            WHEN 'v' THEN 'view'
            WHEN 'm' THEN 'materialized view'
            ELSE c.relkind::text
          END AS object_type
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = ANY($1::text[])
          AND c.relname = ANY($2::text[])
          AND c.relkind IN ('r', 'p', 'v', 'm')
        ORDER BY n.nspname, c.relname
      `,
      [schemaNamen, tabelNamen]
    );

    const objectMap = new Map(
      existing.rows.map((row) => [`${row.table_schema}.${row.table_name}`, row.object_type])
    );

    const schema = CASHFLOW_BRONNEN.map(({ schema, table }) => {
      const key = `${schema}.${table}`;
      return {
        object: key,
        exists: objectMap.has(key),
        objectType: objectMap.get(key) ?? null,
        columns: columns.rows.filter(
          (row) => row.table_schema === schema && row.table_name === table
        ),
        constraints: constraints.rows.filter(
          (row) => row.table_schema === schema && row.table_name === table
        ),
        indexes: indexes.rows.filter(
          (row) => row.table_schema === schema && row.table_name === table
        ),
      };
    });

    return NextResponse.json({
      envPicked: picked,
      connMasked: maskConnStr(conn),
      meta: meta.rows[0],
      cashflowSchemaCheck: schema,
    });
  } catch (error) {
    console.error("DB diagnose fout:", error);
    return NextResponse.json(
      {
        error: "Database-diagnose mislukt",
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
