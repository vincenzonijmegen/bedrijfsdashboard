import { dbRapportage } from '@/lib/dbRapportage';
import { NextResponse } from 'next/server';

export async function POST() {
  const apiUrl = 'https://www.pcadmin.nl/kassaapp/api.php?start=14-07-2024&einde=15-07-2025';
  const username = process.env.KASSA_USER!;
  const password = process.env.KASSA_PASS!;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64'),
      },
    });

    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error('Response is not a JSON-array');
    }

const clean = data
  .filter(row => row.Datum && row.Tijd && row.Omschrijving && row.Aantal && row.Totaalbedrag)
  .map(row => ({
    datum: row.Datum,
    tijdstip: row.Tijd,
    productnaam: row.Omschrijving,
    aantal: parseInt(row.Aantal),
    eenheidsprijs: parseFloat(row.Totaalbedrag.replace(',', '.'))
  }));

    
    const inserts = clean.map(item => {
  return dbRapportage.query(
    `
    INSERT INTO rapportage.omzet (datum, tijdstip, productnaam, aantal, eenheidsprijs)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT DO NOTHING
    `,
    [item.datum, item.tijdstip, item.productnaam, item.aantal, item.eenheidsprijs]
  );
});


    await Promise.all(inserts);

    return NextResponse.json({ success: true, imported: data.length });
  } catch (err: any) {
    console.error('Import fout:', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
