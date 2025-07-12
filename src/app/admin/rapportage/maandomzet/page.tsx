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
    'maart', 'april', 'mei', 'juni',
    'juli', 'augustus', 'september'
  ];

  const jaren = [...new Set(data.map(r => r.jaar))].sort();

  // Draaitabel opbouwen: { maandnaam: { jaar: totaal } }
  const perMaand: Record<string, Record<number, number>> = {};
  data.forEach(({ jaar, maand_start, totaal }) => {
    const totaalNum = typeof totaal === 'string' ? Number(totaal) : totaal;
    const d = new Date(maand_start);
    const maand = maandnamen[d.getMonth() + 1];
    perMaand[maand] = perMaand[maand] || {};
    perMaand[maand][jaar] = totaalNum;
  });

  // Bereken jaartotalen
  const jaarTotalen: Record<number, number> = {};
  jaren.forEach(jaar => {
    jaarTotalen[jaar] = alleMaanden.reduce((sum, maand) => sum + (perMaand[maand]?.[jaar] ?? 0), 0);
  });

  // Bereken gemiddeldes per maand over jaren
  const maandGemiddelden: Record<string, number> = {};
  alleMaanden.forEach(maand => {
    const values = jaren.map(j => perMaand[maand]?.[j] ?? 0);
    const nonZero = values.filter(v => v > 0);
    maandGemiddelden[maand] = nonZero.length
      ? Math.round(nonZero.reduce((a, b) => a + b, 0) / nonZero.length)
      : 0;
  });

  // Functie voor kleurverloop per maand (rij) met pastel inline style
  const getColorStyle = (value: number, all: number[]) => {
    const min = Math.min(...all);
    const max = Math.max(...all);
    if (max === min) return {};
    const pct = (value - min) / (max - min);
    // Pastel overgang van zacht rood naar zacht groen
    const rStart = 255, gStart = 200, b = 200;
    const rEnd = 200, gEnd = 255;
    const r = Math.round(rStart + (rEnd - rStart) * pct);
    const g = Math.round(gStart + (gEnd - gStart) * pct);
    return { backgroundColor: `rgb(${r},${g},${b})`, color: '#000', fontWeight: 'bold' };
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mt-4 mb-6">Maandomzet per jaar</h1>
    <Link href="/admin/rapportage" className="text-sm underline text-blue-600">← Terug naar Rapportage</Link>
      {/* Huidige jaar bijgewerkt t/m laatste omzetdatum */}
      <p className="text-sm text-gray-600 mb-4">
        Huidige jaar bijgewerkt t/m {new Date(
          (await dbRapportage.query(`SELECT MAX(datum) AS max_datum FROM rapportage.omzet`))
            .rows[0].max_datum
        ).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' })}
      </p>

      <table className="w-full border border-gray-400">
        <thead>
          <tr className="bg-gray-200">
            <th className="p-2 border">Maand</th>
            {jaren.map(jaar => (
              <th key={jaar} className="p-2 border text-right">{jaar}</th>
            ))}
            <th className="p-2 border text-right">Gem.</th>
          </tr>
        </thead>
        <tbody>
          {alleMaanden.map(maand => {
            const values = jaren.map(j => perMaand[maand]?.[j] ?? 0);
            return (
              <tr key={maand}>
                <td className="border p-2 font-medium">{maand}</td>
                {jaren.map(jaar => {
                  const val = perMaand[maand]?.[jaar] ?? 0;
                  const style = val ? getColorStyle(val, values) : {};
                  return (
                    <td
                      key={jaar}
                      className="border p-2 text-right"
                      style={style}
                    >
                      {val
                        ? val.toLocaleString('nl-NL', { maximumFractionDigits: 0 })
                        : ''}
                    </td>
                  );
                })}
                <td className="border p-2 text-right font-semibold">
                  {maandGemiddelden[maand]
                    ? maandGemiddelden[maand].toLocaleString('nl-NL', { maximumFractionDigits: 0 })
                    : ''}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="bg-gray-200 font-semibold">
            <td className="border p-2">Totaal per jaar</td>
            {jaren.map(jaar => (
              <td key={jaar} className="border p-2 text-right">
                {jaarTotalen[jaar].toLocaleString('nl-NL', { maximumFractionDigits: 0 })}
              </td>
            ))}
            <td className="border p-2 text-right">—</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
