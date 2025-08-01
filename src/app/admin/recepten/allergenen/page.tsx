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
  const { data: recepten } = useSWR<Recept[]>("/api/recepten", fetcher);
  const { data: allergenenData } = useSWR<ProductAllergenen[]>("/api/allergenen/receptniveau", fetcher);

  // Groepeer allergenen per product
  const gegroepeerd: Record<number, string[]> = {};
  allergenenData?.forEach((r) => {
    if (!gegroepeerd[r.product_id]) gegroepeerd[r.product_id] = [];
    gegroepeerd[r.product_id].push(r.allergeen);
  });

  // Haal allergenen op voor een recept
  function allergenenVoorRecept(r: Recept): string[] {
    const verzameld = new Set<string>();
    r.regels.forEach((regel) => {
      gegroepeerd[regel.product_id]?.forEach((a) => verzameld.add(a));
    });
    return Array.from(verzameld).sort();
  }

  // Groepeer recepten per categorie
  const gegroepeerdPerSoort: Record<string, Recept[]> = {};
  recepten
    ?.filter((r) => !["mixen", "vruchtensmaken"].includes(r.omschrijving ?? ""))
    .forEach((r) => {
      const cat = r.omschrijving || "overig";
      if (!gegroepeerdPerSoort[cat]) gegroepeerdPerSoort[cat] = [];
      gegroepeerdPerSoort[cat].push(r);
    });

  const volgorde = ["melksmaken", "overig"];

  // Excel-export functie
  function exportExcel() {
    const wb = XLSX.utils.book_new();
    const header = ["Smaak", ...ALLERGENEN.map((a) => a.toUpperCase())];
    const rows: any[][] = [header];

    volgorde.forEach((soort) => {
      const recepten = gegroepeerdPerSoort[soort] || [];
      if (rows.length > 1) rows.push([]);
      rows.push(['🧾 Allergenenkaart IJssalon Vincenzo']);
    rows.push(['ALLE SORBETSMAKEN ZIJN VEGANISTISCH EN ALLERGENENVRIJF']);
    rows.push([]);
    rows.push([soort === "overig" ? "OVERIG" : "ROOMIJS"]);

      recepten.sort((a, b) => a.naam.localeCompare(b.naam)).forEach((r) => {
        const allergenen = new Set(allergenenVoorRecept(r));
        rows.push([
          r.naam,
          ...ALLERGENEN.map((a) => (allergenen.has(a) ? "JA" : "")),
        ]);
      });
    });

    rows.push(
      [],
      ["ALLE SORBETSMAKEN ZIJN VEGANISTISCH EN ALLERGENENVRIJF"],
      [
        "Geen vis, selderij, zwaveldioxide, mosterd, weekdieren, schaaldieren, lupine, sesamzaad in ons ijs",
      ],
      ["Amaretto, Tiramisu en Malaga zijn bereid met alcohol"]
    );

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const range = XLSX.utils.decode_range(ws["!ref"]!);

    ws["!autofilter"] = {
      ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: 0, c: header.length - 1 } })
    };
    ws["!freeze"] = { ySplit: 1 };

    rows.forEach((row, R) => {
      row.forEach((_, C) => {
        const addr = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[addr];
        if (!cell) return;

        if (R === 0) {
          cell.s = {
            font: { bold: true },
            fill: { fgColor: { rgb: "DDDDDD" } },
            alignment: { horizontal: "center", vertical: "center" },
          };
        } else if (cell.v === "JA") {
          cell.s = {
            fill: { fgColor: { rgb: "FF0000" } },
            font: { color: { rgb: "FFFFFF" }, bold: true },
            alignment: { horizontal: "center", vertical: "center" },
          };
        } else if (R > 0 && row.length === 1) {
          cell.s = {
            font: { bold: true },
            alignment: { horizontal: "left" },
          };
        } else if (R > header.length && R > range.e.r - 4) {
          cell.s = {
            font: { italic: true, bold: true },
            alignment: { horizontal: "left" },
          };
        } else {
          cell.s = {
            alignment: { horizontal: "center" },
          };
        }
      });
    });

    ws["!cols"] = [{ wch: 25 }, ...ALLERGENEN.map(() => ({ wch: 12 }))];
    XLSX.utils.book_append_sheet(wb, ws, "Allergenenkaart");
    XLSX.writeFile(wb, "allergenenkaart.xlsx");
  }

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6" id="pdf-content">
      <h1 className="text-2xl font-bold text-center">🧾 Allergenenkaart IJssalon Vincenzo</h1>
      <p className="text-center bg-blue-600 text-yellow-300 font-bold text-xl uppercase py-2 rounded">
        ALLE SORBETSMAKEN ZIJN VEGANISTISCH EN ALLERGENENVRIJF
      </p>
      <h1 className="text-2xl font-bold text-center">🧾 Allergenenkaart IJssalon Vincenzo</h1>
<p className="text-center bg-blue-600 text-yellow-300 font-bold text-xl uppercase py-2 rounded">
  ALLE SORBETSMAKEN ZIJN VEGANISTISCH EN ALLERGENENVRIJF
</p>
<div className="space-x-2 print:hidden">
        <button
          onClick={exportPDF}
          id="print-knop"
          className="bg-blue-600 text-white px-4 py-2 rounded"
        >
          📄 Download als PDF
        </button>
        <button
          onClick={exportExcel}
          className="bg-green-600 text-white px-4 py-2rounded"
        >
          📊 Download als Excel
        </button>
      </div>

      

      <div className="overflow-x-auto space-y-6 print:overflow-visible">
        {volgorde.map((soort) => (
          <div key={soort}>
            <h2 className="text-lg font-bold mb-2 uppercase">
              {soort === "overig" ? "OVERIG" : "ROOMIJS"}
            </h2>
            <table className="w-full border text-sm print:text-xs print:border-black">
              <thead>
                <tr className="bg-gray-100 align-middle">
                  <th className="border px-2 py-1 text-left align-middle">Smaak</th>
                  {ALLERGENEN.map((a) => (
                    <th
                      key={a}
                      className="border px-2 py-1 text-center uppercase w-20print:border-black align-middle"
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
                      <tr key={r.id} className="align-middle">
                        <td className="border px-2 py-2whitespace-nowrap text-lg md:text-xl align-middle">
                          {r.naam}
                        </td>
                        {ALLERGENEN.map((a) => (
                          <td
                            key={a}
                            className={`border px-2 py-1 w-20print:border-black align-middle ${
                              aanwezig.has(a) ? "bg-red-500" : ""
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

      <p className="text-center bg-blue-600 text-yellow-300 font-bold text-luppercase py-2 rounded">
        geen vis, selderij, zwaveldioxide, mosterd, weekdieren, schaaldieren, lupine, sesamzaadin ons ijs
      </p>
      <p className="text-center bg-blue-600 text-yellow-300 font-bold text-luppercase py-2 rounded">
        AMARETTO - TIRAMISU - MALAGA zijn met alcohol bereid
      </p>
    </main>
  );
}

async function exportPDF() {
  const knop = document.querySelector("button#print-knop") as HTMLElement;
  if (knop) knop.style.display = "none";
  await new Promise((resolve) => setTimeout(resolve, 100));

  const input = document.getElementById("pdf-content");
  if (!input) return;

  const canvas = await html2canvas(input, {
    scale: 1,
    backgroundColor: null,
    useCORS: true,
    windowWidth: input.scrollWidth,
    windowHeight: input.scrollHeight,
  });
  const imgData = canvas.toDataURL("image/png");

  const pdf = new jsPDF({ orientation: "portrait",unit: "px", format: "a4" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const ratio = Math.min(pageWidth / canvas.width,pageHeight / canvas.height);
  const scaledWidth = canvas.width * ratio;
  const scaledHeight = canvas.height * ratio;
  const x = (pageWidth - scaledWidth) / 2;
  const y = (pageHeight - scaledHeight) / 2;

  pdf.addImage(imgData, "PNG", x, y,scaledWidth, scaledHeight);
  pdf.save("allergenenkaart.pdf");
  if (knop) knop.style.display = "inline-block";
}

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Fout bij ophalen");
  return res.json();
}
