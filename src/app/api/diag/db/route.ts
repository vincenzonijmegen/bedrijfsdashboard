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

export async function GET() {
  const picked = process.env.POSTGRES_URL ? "POSTGRES_URL" : (process.env.DATABASE_URL ? "DATABASE_URL" : "NONE");
  const conn = process.env.POSTGRES_URL || process.env.DATABASE_URL || "";

  // Haal basisinfo op uit de DB waar de API nu ECHT mee praat
  const meta = await dbRapportage.query(`
    SELECT current_database() AS db,
           current_user AS usr,
           to_regclass('rapportage.omzet') IS NOT NULL   AS raw_exists,
           to_regclass('rapportage.omzet_maand') IS NOT NULL AS mv_exists,
           (SELECT COUNT(*)::int FROM rapportage.omzet)        AS raw_count,
           (SELECT COUNT(*)::int FROM rapportage.omzet_maand)  AS mv_count,
           (SELECT MAX(datum) FROM rapportage.omzet)           AS raw_max
  `);

  return NextResponse.json({
    envPicked: picked,
    connMasked: maskConnStr(conn),
    meta: meta.rows[0],
  });
}
