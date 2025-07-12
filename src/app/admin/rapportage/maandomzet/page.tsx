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

  const jaren = [...new Set(data.map(r => r.jaar))].sort();

  // Draaitabel opbouwen: { maandnaam: { jaar: totaal } }
  const perMaand: Record<string, Record<number, number>> = {};
  data.forEach(({ jaar, maand_start, totaal }) => {
    const d = new Date(maand_start);
    const maand = maandnamen[d.getMonth() + 1];
    perMaand[maand] = perMaand[maand] || {};
    perMaand[maand][jaar] = totaal;
  });

  // Functie voor kleurverloop per maand (rij) met inline style
  const getColorStyle = (value: number, all: number[]) => {
    const min = Math.min(...all);
    const max = Math.max(...all);
    if (max === min) return {};
    const pct = (value - min) / (max - min);
    const r = Math.round(255 - 255 * pct);
    const g = Math.round(255 * pct);
    return { backgroundColor: `rgb(${r},${g},0)`, color: '#fff' };
  };

  return (
    <div className="p-6">
      <Link href="/admin" className="text-sm underline text-blue-600">← Terug naar admin</Link>
      <h1 className="text-2xl font-bold mt-4 mb-6">Maandomzet per jaar</h1>

      <table className="w-full border border-gray-400">
        <thead>
          <tr className="bg-gray-200">
            <th className="p-2 border">Maand</th>
            {jaren.map(jaar => (
              <th key={jaar} className="p-2 border text-right">{jaar}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {alleMaanden.map(maand => {
            const values = jaren.map(j => perMaand[maand]?.[j] || 0);
            return (
              <tr key={maand}>
                <td className="border p-2 font-medium">{maand}</td>
                {jaren.map(jaar => {
                  const val = perMaand[maand]?.[jaar] || 0;
                  const style = val > 0 ? getColorStyle(val, values) : {};
                  return (
                    <td
                      key={jaar}
                      className="border p-2 text-right"
                      style={style}
                    >
                      {val > 0 && val.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' })}
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
