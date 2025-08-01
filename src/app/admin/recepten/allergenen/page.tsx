// src/app/admin/recepten/allergenenkaart/page.tsx
"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import * as XLSX from "xlsx-js-style";

const ALLERGENEN = ["gluten", "soja", "ei", "melk", "noten", "pinda", "tarwe"];

interface Recept {
  id: number;
  naam: string;
  omschrijving?: string;
  regels: { product_id: number }[];
}

interface ProductAllergenen {
  product_id: number;
  allergeen: string;
}

export default function AllergenenKaart() {
  const { data: recepten } = useSWR<Recept[]>('/api/recepten', fetcher);
  const { data: allergenenData } = useSWR<ProductAllergenen[]>('/api/allergenen/receptniveau', fetcher);

  // Groeperen van allergenen per product
  const gegroepeerd: Record<number, string[]> = {};
  allergenenData?.forEach((r) => {
    if (!gegropeerd[r.product_id]) gegroepeerd[r.product_id] = [];
    gegroepeerd[r.product_id].push(r.allergeen);
  });

  // Functie om allergenen voor een recept te krijgen
  function allergenenVoorRecept(r: Recept): string[] {
    const verzameld = new Set<string>();
    r.regels.forEach((regel) => {
      gegroepeerd[regel.product_id]?.forEach((a) => verzameld.add(a));
    });
    return Array.from(verzameld).sort();
  }

  // Groeperen recepten per soort
  const gegroepeerdPerSoort: Record<string, Recept[]> = {};
  recepten
    ?.filter((r) => !['mixen', 'vruchtensmaken'].includes(r.omschrijving ?? ''))
    .forEach((r) => {
      const cat = r.omschrijving || 'overig';
      if (!gegroepeerdPerSoort[cat]) gegroepeerdPerSoort[cat] = [];
      gegroepeerdPerSoort[cat].push(r);
    });

  const volgorde = ['melksmaken', 'overig'];

  // Excel-export functie
  function exportExcel() {
    const wb = XLSX.utils.book_new();

    volgorde.forEach((soort) => {
      const lijst = gegroepeerdPerSoort[soort] || [];
      if (!lijst.length) return;

      // Header en data-rows
      const header = ['Smaak', ...ALLERGENEN.map((a) => a.toUpperCase())];
      const dataRows = lijst
        .sort((a, b) => a.naam.localeCompare(b.naam))
        .map((r) => {
          const set = new Set(allergenenVoorRecept(r));
          return [r.naam, ...ALLERGENEN.map((a) => (set.has(a) ? 'JA' : ''))];
        });

      // Uitlegregels onderaan
      const uitlegRows = [
        [],
        ['ALLE SORBETSMAKEN ZIJN VEGANISTISCH EN ALLERGENENVRIJF'],
        ['Geen vis, selderij, zwaveldioxide, mosterd, weekdieren, schaaldieren, lupine, sesamzaad in ons ijs'],
        ['Amaretto, Tiramisu en Malaga zijn bereid met alcohol'],
      ];

      const sheetData = [header, ...dataRows, ...uitlegRows];
      const ws = XLSX.utils.aoa_to_sheet(sheetData);
      const range = XLSX.utils.decode_range(ws['!ref']!);

      // Autofilter en header bevriezen
      ws['!autofilter'] = { ref: XLSX.utils.encode_range(range.s.r, range.s.c, range.s.r, range.e.c) };
      ws['!freeze'] = { ySplit: 1 };

      // Merges voor uitlegregels
      const mergeStart = dataRows.length + 1;
      ws['!merges'] = [
        { s: { r: mergeStart, c: 0 }, e: { r: mergeStart, c: range.e.c } },
        { s: { r: mergeStart + 1, c: 0 }, e: { r: mergeStart + 1, c: range.e.c } },
        { s: { r: mergeStart + 2, c: 0 }, e: { r: mergeStart + 2, c: range.e.c } },
      ];

      // Styling van de cellen
      for (let R = 0; R <= range.e.r; R++) {
        for (let C = 0; C <= range.e.c; C++) {
          const addr = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = ws[addr];
          if (!cell) continue;
          if (R === 0) {
            cell.s = {
              font: { bold: true, sz: 12 },
              fill: { fgColor: { rgb: 'B0D9FF' } },
              alignment: { horizontal: 'center', vertical: 'center' },
            };
          } else if (C > 0 && cell.v === 'JA') {
            cell.s = {
              fill: { fgColor: { rgb: 'FF0000' } },
              font: { color: { rgb: 'FFFFFF' }, bold: true },
              alignment: { horizontal: 'center', vertical: 'center' },
            };
          } else if (R > dataRows.length) {
            cell.s = { font: { italic: true, bold: true }, alignment: { horizontal: 'left' } };
          }
        }
      }

      // Kolombreedtes instellen
      ws['!cols'] = [{ wch: 25 }, ...ALLERGENEN.map(() => ({ wch: 12 }))];
      XLSX.utils.book_append_sheet(wb, ws, 'Allergenenkaart');
    });

    XLSX.writeFile(wb, 'allergenenkaart.xlsx');
  }

  // PDF-export functie
  async function exportPDF() {
    const knop = document.querySelector('button#print-knop') as HTMLElement;
    if (knop) knop.style.display = 'none';
    await new Promise((resolve) => setTimeout(resolve, 100));
    const input = document.getElementById('pdf-content');
    if (!input) return;
    const canvas = await html2canvas(input, { scale: 1, backgroundColor: null, useCORS: true });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const ratio = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
    const x = (pageWidth - canvas.width * ratio) / 2;
    const y = (pageHeight - canvas.height * ratio) / 2;
    pdf.addImage(imgData, 'PNG', x, y, canvas.width * ratio, canvas.height * ratio);
    pdf.save('allergenenkaart.pdf');
    if (knop) knop.style.display = 'inline-block';
  }

  return (
    <main id='pdf-content' className='max-w-6xl mx-auto p-6 space-y-6'>
      <h1 className='text-2xl font-bold text-center'>🧾 Allergenenkaart IJssalon Vincenzo</h1>
      <p className='text-center bg-blue-600 text-yellow-300 font-bold text-xl uppercase py-2 rounded'>
        ALLE SORBETSMAKEN ZIJN VEGANISTISCH EN ALLERGENENVRIJF
      </p>
      <div className='space-x-2 print:hidden'>
        <button id='print-knop' onClick={exportPDF} className='bg-blue-600 text-white px-4 py-2 rounded'>📄 Download als PDF</button>
        <button onClick={exportExcel} className='bg-green-600 text-white px-4 py-2 rounded'>📊 Download als Excel</button>
      </div>
      <div className='overflow-x-auto space-y-6 print:overflow-visible'>
        {volgorde.map((soort) => (
          <div key={soort}>
            <h2 className='text-lg font-bold mb-2 uppercase'>{soort === 'overig' ? 'OVERIG' : 'ROOMIJS'}</h2>
            <table className='w-full border text-sm print:text-xs print:border-black'>
              <thead>
                <tr className='bg-gray-100 align-middle'>
                  <th className='border px-2 py-1 text-left align-middle'>Smaak</th>
                  {ALLERGENEN.map((a) => (
                    <th
                      key={a}
                      className='border px-2 py-1 text-center uppercase w-20 print:border-black align-middle'
                    >
                      {a}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gegroepeerdPerSoort[soort]
                  ?.sort((a, b) => a.naam.localeCompare(b.naam))
                  .map((r) => {
                    const aanwezig = new Set(allergenenVoorRecept(r));
                    return (
                      <tr key={r.id} className='align-middle'>
                        <td className='border px-2 py-2 whitespace-nowrap text-lg md:text-xl align-middle'>
                          {r.naam}
                        </td>
                        {ALLERGENEN.map((a) => (
                          <td
                            key={a}
                            className={`border px-2 py-1 w-20 print:border-black align-middle ${
                              aanwezig.has(a) ? 'bg-red-500' : ''
                            }`}
                          />
                        ))}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      <p className='text-center bg-blue-600 text-yellow-300 font-bold text-l uppercase py-2 rounded'>
        Geen vis, selderij, zwaveldioxide, mosterd, weekdieren, schaaldieren, lupine, sesamzaad in ons ijs
      </p>
      <p className='text-center bg-blue-600 text-yellow-300 font-bold text-l uppercase py-2 rounded'>
        Amaretto, Tiramisu en Malaga zijn bereid met alcohol
      </p>
    </main>
  );
}

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Fout bij ophalen');
  return res.json();
}
