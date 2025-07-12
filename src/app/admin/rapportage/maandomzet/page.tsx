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

  // Draaitabel: { maand: { jaar: omzet } }
  const perMaand: Record<string, Record<number, number>> = {};
  data.forEach(({ jaar, maand_start, totaal }) => {
    const maand = maandnamen[new Date(maand_start).getMonth() + 1];
    perMaand[maand] = perMaand[maand] || {};
    perMaand[maand][jaar] = totaal;
  });

  // Hulp: celkleur op basis van waarde (binnen rij)
  const getColor = (value: number, valuesInRow: number[]) => {
    const min = Math.min(...valuesInRow);
    const max = Math.max(...valuesInRow);
    if (max === min) return 'bg-white'; // alle gelijk

    const percentage = (value - min) / (max - min);
    const r = Math.round(255 - 255 * percentage);
    const g = Math.round(255 * percentage);
    return `bg-[rgb(${r},${g},0)] text-white`;
  };

  // Totalen per jaar
  const totaalPerJaar: Record<number, number> = {};
  jaren.forEach((jaar) => {
    totaalPerJaar[jaar] = alleMaanden.reduce((sum, maand) => {
      return sum + (perMaand[maand]?.[jaar] || 0);
    }, 0);
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
            <th className="p-2 border text-right">Totaal</th>
            <th className="p-2 border text-right">Gemiddelde</th>
          </tr>
        </thead>
        <tbody>
          {alleMaanden.map((maand) => {
            const waarden = jaren.map((jaar) => perMaand[maand]?.[jaar] || 0);
            const totaal = waarden.reduce((a, b) => a + b, 0);
            const gemiddeld = waarden.length > 0 ? Math.round(totaal / waarden.filter(v => v > 0).length) : 0;

            return (
              <tr key={maand}>
                <td className="border p-2 font-medium">{maand}</td>
                {jaren.map((jaar, index) => {
                  const value = perMaand[maand]?.[jaar];
                  const kleur = value ? getColor(value, waarden) : '';
                  return (
                    <td key={jaar} className={`border p-2 text-right ${kleur}`}>
                      {value?.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' }) || ''}
                    </td>
                  );
                })}
                <td className="border p-2 text-right font-semibold">
                  {totaal ? totaal.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' }) : ''}
                </td>
                <td className="border p-2 text-right font-semibold">
                  {gemiddeld ? gemiddeld.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' }) : ''}
                </td>
              </tr>
            );
          })}

          {/* Rij onderaan met jaartotalen */}
          <tr className="bg-gray-100 font-semibold">
            <td className="border p-2">Totaal per jaar</td>
            {jaren.map((jaar) => (
              <td key={jaar} className="border p-2 text-right">
                {totaalPerJaar[jaar]?.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' }) || ''}
              </td>
            ))}
            <td colSpan={2} className="border p-2 text-center text-gray-500">—</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
