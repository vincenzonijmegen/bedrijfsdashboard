// Bestand: src/app/admin/rapportage/maandomzet/page.tsx
import Link from 'next/link';
import { dbRapportage } from '@/lib/dbRapportage';

export default async function MaandomzetPage() {
  const resultaat = await dbRapportage.query(`
    SELECT 
      EXTRACT(YEAR FROM datum) AS jaar,
      DATE_TRUNC('month', datum) AS maand_start,
      ROUND(SUM(aantal * eenheidsprijs)) AS totaal
    FROM rapportage.omzet
    GROUP BY jaar, maand_start
    ORDER BY maand_start
  `);

  const data = resultaat.rows;

  const maandnamen: Record<number, string> = {
    1: 'januari', 2: 'februari', 3: 'maart', 4: 'april',
    5: 'mei', 6: 'juni', 7: 'juli', 8: 'augustus',
    9: 'september', 10: 'oktober', 11: 'november', 12: 'december',
  };

  const alleMaanden = [
    'januari', 'februari', 'maart', 'april', 'mei', 'juni',
    'juli', 'augustus', 'september', 'oktober', 'november', 'december',
  ];

  const jaren = [...new Set(data.map((r) => r.jaar))].sort();

  // Maak een draaitabel: { maandnaam: { jaar: totaalbedrag } }
  const perMaand: Record<string, Record<number, number>> = {};
  data.forEach(({ jaar, maand_start, totaal }) => {
    const maandDate = new Date(maand_start);
    const maandIndex = maandDate.getMonth() + 1;
    const maand = maandnamen[maandIndex];
    perMaand[maand] = perMaand[maand] || {};
    perMaand[maand][jaar] = totaal;
  });

  // Bepaal de kleur op basis van de waarde binnen een maand (per rij)
  const getColor = (value: number, valuesInRow: number[]) => {
    const min = Math.min(...valuesInRow);
    const max = Math.max(...valuesInRow);
    if (max === min) return 'bg-white';
    const percentage = (value - min) / (max - min);
    const r = Math.round(255 - 255 * percentage);
    const g = Math.round(255 * percentage);
    return `bg-[rgb(${r},${g},0)] text-white`;
  };

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
          {alleMaanden.map((maand) => {
            const waarden = jaren.map((jaar) => perMaand[maand]?.[jaar] || 0);
            return (
              <tr key={maand}>
                <td className="border p-2 font-medium">{maand}</td>
                {jaren.map((jaar) => {
                  const value = perMaand[maand]?.[jaar];
                  const kleur = typeof value === 'number' ? getColor(value, waarden) : '';
                  return (
                    <td key={jaar} className={`border p-2 text-right ${kleur}`}>
                      {typeof value === 'number'
                        ? value.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' })
                        : ''}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
