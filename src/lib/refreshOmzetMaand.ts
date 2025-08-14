// src/lib/refreshOmzetMaand.ts
import { dbRapportage } from "@/lib/dbRapportage";

export async function refreshOmzetMaand() {
  // Check of de MV al eens gevuld is
  const res = await dbRapportage.query(`
    SELECT ispopulated
    FROM pg_matviews
    WHERE schemaname = 'rapportage'
      AND matviewname = 'omzet_maand'
  `);

  const populated = !!res.rows?.[0]?.ispopulated;

  // Belangrijk: NIET binnen een open transaction aanroepen
  if (populated) {
    await dbRapportage.query(
      `REFRESH MATERIALIZED VIEW CONCURRENTLY rapportage.omzet_maand`
    );
  } else {
    await dbRapportage.query(
      `REFRESH MATERIALIZED VIEW rapportage.omzet_maand`
    );
  }
}
