import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const jaar = req.nextUrl.searchParams.get('jaar');

  if (!jaar) {
    return NextResponse.json({ error: 'jaar ontbreekt' }, { status: 400 });
  }

  // haal data uit je bestaande endpoint
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/kasboek/kasstaat?jaar=${jaar}`, {
    cache: 'no-store',
  });

  const data = await res.json();

  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`Kasstaat ${jaar}`);

  data.weken.forEach((week: any) => {
    sheet.addRow([`Week ${week.weekNr}`]).font = { bold: true };
    sheet.addRow([]);

    sheet.addRow([
      'Categorie',
      'Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo',
      'Totaal'
    ]);

    // beginsaldo
    sheet.addRow([
      'Beginsaldo kas', '', '', '', '', '', '', '',
      week.beginsaldoKas
    ]);

    // ontvangsten
    Object.values(week.ontvangsten).forEach((r: any) => {
      sheet.addRow([
        r.label,
        ...r.dagen,
        r.weekTotaal
      ]);
    });

    sheet.addRow([
      'Totaal ontvangsten', '', '', '', '', '', '', '',
      week.totaalOntvangsten
    ]);

    // uitgaven
    Object.values(week.uitgaven).forEach((r: any) => {
      sheet.addRow([
        r.label,
        ...r.dagen,
        r.weekTotaal
      ]);
    });

    sheet.addRow([
      'Totaal uitgaven', '', '', '', '', '', '', '',
      week.totaalUitgaven
    ]);

    sheet.addRow([
      'Eindsaldo kas', '', '', '', '', '', '', '',
      week.eindsaldoKas
    ]);

    sheet.addRow([]);
    sheet.addRow([]);
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new NextResponse(buffer, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename=kasstaat-${jaar}.xlsx`,
    },
  });
}