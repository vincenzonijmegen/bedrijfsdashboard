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
      if (!gegropeerdPerSoort[cat]) gegroepeerdPerSoort[cat] = [];
      gegroepeerdPerSoort[cat].push(r);
    });

  const volgorde = ["melksmaken", "overig"];

  // Excel-export functie
  function exportExcel() {
    const wb = XLSX.utils.book_new();

    volgorde.forEach((soort) => {
      const receptenLijst = gegroepeerdPerSoort[soort];
      if (!receptenLijst) return;

      // Maak header en data rijen
      const hoofd = ["Smaak", ...ALLERGENEN.map((a) => a.toUpperCase())];
      const rijen = receptenLijst
        .sort((a, b) => a.naam.localeCompare(b.naam))
        .map((r) => {
          const allergenen = new Set(allergenenVoorRecept(r));
          return [
            r.naam,
            ...ALLERGENEN.map((a) => (allergenen.has(a) ? "JA" : "")),
          ];
        });

      // Voeg uitlegregels onderaan
      const uitleg = [
        [],
        ["ALLE SORBETSMAKEN ZIJN VEGANISTISCH EN ALLERGENENVRIJF"],
        [
          "Geen vis, selderij, zwaveldioxide, mosterd, weekdieren, schaaldieren, lupine, sesamzaad in ons ijs"
        ],
        ["Amaretto, Tiramisu en Malaga zijn bereid met alcohol"]
      ];

      const data = [hoofd, ...rijen, ...uitleg];
      const ws = XLSX.utils.aoa_to_sheet(data);

      // Pas opmaak toe
      const range = XLSX.utils.decode_range(ws["!ref"]!);
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const addr = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = ws[addr];
          if (!cell) continue;

          // Header
          if (R === 0) {
            cell.s = {
              font: { bold: true },
              fill: { fgColor: { rgb: "DDDDDD" } },
              alignment: { horizontal: "center", vertical: "center" },
              border: {
                top: { style: "thin", color: { rgb: "000000" } },
                bottom: { style: "thin", color: { rgb: "000000" } },
                left: { style: "thin", color: { rgb: "000000" } },
                right: { style: "thin", color: { rgb: "000000" } },
              },
            };
          }
          // Uitlegregels
          else if (R >= rijen.length + 2) {
            cell.s = {
              font: { bold: true, italic: true },
              fill: { fgColor: { rgb: "FFFFCC" } },
              alignment: { horizontal: "left", vertical: "center" },
            };
          }
          // Allergenen aanwezig
          else if (C > 0 && cell.v === "JA") {
            cell.s = {
              fill: { fgColor: { rgb: "FF0000" } },
              font: { color: { rgb: "FFFFFF" }, bold: true },
              alignment: { horizontal: "center", vertical: "center" },
              border: {
                top: { style: "thin", color: { rgb: "000000" } },
                bottom: { style: "thin", color: { rgb: "000000" } },
                left: { style: "thin", color: { rgb: "000000" } },
                right: { style: "thin", color: { rgb: "000000" } },
              },
            };
          }
          // Lege of "nee"
          else {
            cell.s = {
              alignment: { horizontal: "center", vertical: "center" },
              border: {
                top: { style: "thin", color: { rgb: "CCCCCC" } },
                bottom: { style: "thin", color: { rgb: "CCCCCC" } },
                left: { style: "thin", color: { rgb: "CCCCCC" } },
                right: { style: "thin", color: { rgb: "CCCCCC" } },
              },
            };
          }
        }
      }

      // Kolombreedte
      ws["!cols"] = [{ wch: 22 }, ...ALLERGENEN.map(() => ({ wch: 10 }))];
      XLSX.utils.book_append_sheet(wb, ws, soort === "overig" ? "OVERIG" : "ROOMIJS");
    });

    // Sla op
    XLSX.writeFile(wb, "allergenenkaart.xlsx");
  }

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-6" id="pdf-content">
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

      <h1 className="text-2xl font-bold text-center">🧾 Allergenenkaart IJssalon Vincenzo</h1>
      <p className="text-center bg-blue-600 text-yellow-300 font-bold text-xl uppercase py-2rounded">
        ALLE SORBETSMAKEN ZIJN VEGANISTISCH EN ALLERGENENVRIJF
      </p>

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
  const knop = document.querySelector("button#print-knop") asHTMLElement;
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
