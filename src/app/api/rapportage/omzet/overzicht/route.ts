import { dbRapportage } from '@/lib/dbRapportage';

export async function GET() {
  const result = await dbRapportage.query(`
    SELECT datum, COUNT(*) AS aantal
    FROM rapportage.omzet
    GROUP BY datum
    ORDER BY datum DESC
    LIMIT 10
  `);

  return Response.json(result.rows);
}
