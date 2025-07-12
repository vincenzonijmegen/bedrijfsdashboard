// Bestand: src/app/admin/rapportage/maandomzet/page.tsx
import Link from 'next/link';
import { dbRapportage } from '@/lib/dbRapportage';

export default async function MaandomzetPage() {
  const resultaat = await dbRapportage.query(`
    SELECT 
      EXTRACT(YEAR FROM datum) AS jaar,
      TO_CHAR(datum, 'Month') AS maand,
      DATE_TRUNC('month', datum) AS maand_start,
      ROUND(SUM(aantal * eenheidsprijs)) AS totaal
    FROM rapportage.omzet
    GROUP BY jaar, maand, maand_start
    ORDER BY maand_start
  `);

  const data = resultaat.rows;

  const jaren = [...new Set(data.map((r) => r.jaar))];
  const maanden = [...new Set(data.map((r) => r.maand_start.toISOString().slice(0, 7)))].sort();

  const perMaand: Record<string, Record<number, number>> = {};
  data.forEach(({ jaar, maand_start, totaal }) => {
    const key = maand_start.toISOString().slice(0, 7);
    perMaand[key] = perMaand[key] || {};
    perMaand[key][jaar] = totaal;
  });

  return (
    <div className="p-6">
      <Link href="/admin" className="text-sm underline text-blue-600">← Terug naar admin</Link>
      <h1 className="text-2xl font-bold mt-4 mb-6">Maandomzet per jaar</h1>

      <table className="border border-gray-400">
        <thead>
          <tr className="bg-gray-200">
            <th className="p-2 border">Maand</th>
            {jaren.map((jaar) => (
              <th key={jaar} className="p-2 border text-right">{jaar}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {maanden.map((maand) => (
            <tr key={maand}>
              <td className="border p-2 font-medium">{new Date(maand + '-01').toLocaleDateString('nl-NL', { month: 'long' })}</td>
              {jaren.map((jaar) => (
                <td key={jaar} className="border p-2 text-right">
                  {perMaand[maand][jaar]?.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' }) || ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
