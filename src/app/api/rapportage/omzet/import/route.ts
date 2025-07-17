// src/app/api/rapportage/omzet/import/route.ts
import { dbRapportage } from '@/lib/dbRapportage';
import { NextResponse } from 'next/server';

export async function POST() {
  const apiUrl = 'https://www.pcadmin.nl/kassaapp/api.php?start=14-07-2024&einde=15-07-2025';

  try {
    const response = await fetch(apiUrl);
    const data = await response.json();

    if (!Array.isArray(data)) {
      throw new Error('Ongeldig formaat van API-response');
    }

    const insertPromises = data.map((item: any) => {
      const { datum, tijdstip, product, aantal, verkoopprijs } = item;

      return dbRapportage.query(
        `
        INSERT INTO rapportage.omzet (datum, tijdstip, productnaam, aantal, eenheidsprijs)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT DO NOTHING
        `,
        [datum, tijdstip, product, aantal, verkoopprijs]
      );
    });

    await Promise.all(insertPromises);

    return NextResponse.json({ success: true, records: data.length });
  } catch (error: any) {
    console.error('Importfout:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
