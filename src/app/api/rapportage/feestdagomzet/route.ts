// Bestand: src/pages/api/rapportage/feestdagomzet.ts
import { dbRapportage } from '@/lib/dbRapportage';
import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const resultaat = await dbRapportage.query(`
      SELECT
        f.naam AS feestdag,
        EXTRACT(YEAR FROM f.datum) AS jaar,
        ROUND(SUM(o.aantal * o.eenheidsprijs)) AS totaal
      FROM rapportage.feestdagen f
      LEFT JOIN rapportage.omzet o ON o.datum = f.datum
      GROUP BY f.naam, jaar
      ORDER BY f.datum
    `);

    res.status(200).json(resultaat.rows);
  } catch (error) {
    console.error('API fout:', error);
    res.status(500).json({ error: 'Fout bij ophalen feestdagomzet' });
  }
}
