'use client';

interface AutoTableDoc extends jsPDF {
  lastAutoTable: { finalY: number };
}


import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';
import isoWeek from 'dayjs/plugin/isoWeek';
import Link from 'next/link';

dayjs.extend(isoWeek);

type Shift = {
  Datum: string;
  Dag: string;
  Starttijd: string;
  Eindtijd: string;
  Dienst: string;
  Week: number;
};

export default function OpenShiftsPage() {
  const [data, setData] = useState<Shift[]>([]);

  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const workbook = XLSX.read(evt.target?.result, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const rawRows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]) as Record<string, string>[];

      const filtered: Shift[] = rawRows.map((row) => {
        const datum = dayjs(row['Datum']);
        return {
          Datum: datum.format('DD-MM-YYYY'),
          Dag: row['Dag'],
          Starttijd: row['Starttijd'],
          Eindtijd: row['Eindtijd'],
          Dienst: row['Dienst'],
          Week: datum.isoWeek(),
        };
      });

      filtered.sort((a, b) =>
        dayjs(a.Datum, 'DD-MM-YYYY').diff(dayjs(b.Datum, 'DD-MM-YYYY'))
      );

      setData(filtered);
    };

    reader.readAsBinaryString(file);
  };

  const generatePDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Open Shifts', 14, 18);
    let currentY = 28;

    const grouped: Record<number, Shift[]> = data.reduce((acc, row) => {
      acc[row.Week] = acc[row.Week] || [];
      acc[row.Week].push(row);
      return acc;
    }, {} as Record<number, Shift[]>);

    Object.entries(grouped)
      .sort(([a], [b]) => Number(a) - Number(b))
      .forEach(([week, rows]) => {
        rows.sort((a, b) =>
          dayjs(a.Datum, 'DD-MM-YYYY').diff(dayjs(b.Datum, 'DD-MM-YYYY'))
        );

        if (currentY + rows.length * 6 + 20 > doc.internal.pageSize.height) {
          doc.addPage();
          currentY = 20;
        }

        currentY += 6;
        doc.setFontSize(11);
        doc.text(`Week ${week}`, 14, currentY);
        currentY += 5;

        autoTable(doc, {
          startY: currentY,
          head: [['Datum', 'Dag', 'Starttijd', 'Eindtijd', 'Dienst']],
          body: rows.map((r) => [
            r.Datum,
            r.Dag,
            r.Starttijd,
            r.Eindtijd,
            r.Dienst,
          ]),
          theme: 'grid',
          margin: { left: 14, right: 14 },
          styles: { fontSize: 9, cellPadding: 1.5 },
          headStyles: {
            fillColor: [0, 51, 102],
            textColor: 255,
          },
          columnStyles: {
            0: { cellWidth: 30 },
            1: { cellWidth: 18 },
            2: { cellWidth: 28 },
            3: { cellWidth: 28 },
            4: { cellWidth: 60 },
          },
        });

       currentY = (doc as AutoTableDoc).lastAutoTable.finalY + 3;
      });

    doc.save('OpenShifts.pdf');
  };

  return (
    <div className="p-6 font-sans max-w-3xl mx-auto">
      <Link href="/" className="text-blue-600 underline block mb-6">
        ← Terug naar startpagina
      </Link>
      <h1 className="text-2xl font-bold mb-4">Open Shifts PDF Generator</h1>
      <input type="file" accept=".xlsx,.xls" onChange={handleExcelUpload} />
      {data.length > 0 && (
        <button
          onClick={generatePDF}
          className="bg-blue-600 text-white rounded px-4 py-2 mt-4 hover:bg-blue-700"
        >
          Genereer PDF
        </button>
      )}
    </div>
  );
}
