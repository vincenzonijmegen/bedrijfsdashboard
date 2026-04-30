"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  CalendarDays,
  CheckCircle2,
  Download,
  Loader2,
  Plus,
  Trash2,
  Users,
} from "lucide-react";

interface Regel {
  id: number;
  medewerker_id: number;
  naam: string;
  startdatum: string;
  einddatum: string;
  max_shifts_per_week: number;
  opmerkingen?: string;
  [key: string]: any;
}

const dagen = [
  "maandag",
  "dinsdag",
  "woensdag",
  "donderdag",
  "vrijdag",
  "zaterdag",
  "zondag",
];

const dagLabels: Record<string, string> = {
  maandag: "Ma",
  dinsdag: "Di",
  woensdag: "Wo",
  donderdag: "Do",
  vrijdag: "Vr",
  zaterdag: "Za",
  zondag: "Zo",
};

export default function BeschikbaarheidOverzicht() {
  const { data, error, mutate } = useSWR<Regel[]>(
    "/api/beschikbaarheid",
    (url: string) => fetch(url).then((res) => res.json())
  );

  const handleDelete = async (id: number) => {
    if (!confirm("Weet je zeker dat je deze periode wilt verwijderen?")) return;

    await fetch(`/api/beschikbaarheid?id=${id}`, { method: "DELETE" });
    mutate();
  };

  const totalen = useMemo(() => {
    const result: Record<string, { s1: number; s2: number }> = {};

    dagen.forEach((dag) => {
      result[dag] = { s1: 0, s2: 0 };
    });

    (data || []).forEach((regel) => {
      dagen.forEach((dag) => {
        if (regel[`${dag}_1`]) result[dag].s1 += 1;
        if (regel[`${dag}_2`]) result[dag].s2 += 1;
      });
    });

    return result;
  }, [data]);

  const exportToPDF = async () => {
    // @ts-expect-error: html2pdf.js heeft geen types
    const html2pdf = (await import("html2pdf.js")).default;
    const element = document.getElementById("pdf-content");
    if (!element) return;

    html2pdf()
      .set({
        margin: [0.25, 0.25, 0.25, 0.25],
        filename: "Beschikbaarheid-per-medewerker.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: {
          scale: 1.5,
          useCORS: true,
          scrollY: 0,
        },
        jsPDF: {
          unit: "in",
          format: "a4",
          orientation: "landscape",
        },
        pagebreak: {
          mode: ["css", "legacy"],
          avoid: ["tr", "table"],
        },
      })
      .from(element)
      .save();
  };

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 px-6 py-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-red-700">
          Fout bij laden beschikbaarheid.
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-100 px-6 py-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Beschikbaarheid laden…</p>
        </div>
      </div>
    );
  }

  const totaalRegels = data.length;
  const medewerkers = new Set(data.map((r) => r.medewerker_id)).size;

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-600">
                <CalendarDays className="h-4 w-4" />
                Planning / Beschikbaarheid
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Beschikbaarheid per medewerker
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Overzicht van opgegeven beschikbaarheid per periode en per shift.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-xl bg-blue-50 px-4 py-3 ring-1 ring-blue-100">
                <div className="text-xs font-medium uppercase tracking-wide text-blue-600">
                  Regels
                </div>
                <div className="text-2xl font-bold text-blue-950">
                  {totaalRegels}
                </div>
              </div>

              <div className="rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
                <div className="text-xs font-medium uppercase tracking-wide text-emerald-600">
                  Medewerkers
                </div>
                <div className="text-2xl font-bold text-emerald-950">
                  {medewerkers}
                </div>
              </div>

              <button
                onClick={exportToPDF}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <Download size={16} />
                PDF
              </button>

              <Link
                href="/admin/beschikbaarheid/nieuw"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <Plus size={16} />
                Nieuwe beschikbaarheid
              </Link>
            </div>
          </div>
        </div>

       <section
          id="pdf-content"
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm [&_.pdf-hide]:hidden"
        >
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                <Users size={20} />
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-950">
                  Beschikbaarheidsregels
                </h2>
                <p className="text-sm text-slate-500">
                  Groene vinkjes betekenen beschikbaar voor die shift.
                </p>
              </div>
            </div>
          </div>

          {data.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">
              Nog geen beschikbaarheid opgegeven.
            </div>
          ) : (
            <div className="w-full bg-white">
              <table className="w-full table-fixed text-[11px]">
                <colgroup>
                  <col className="w-[20%]" />
                  <col className="w-[17%]" />
                  <col className="w-[5%]" />
                  {dagen.flatMap((dag) => [
                    <col key={`${dag}-1`} className="w-[4%]" />,
                    <col key={`${dag}-2`} className="w-[4%]" />,
                  ])}
                  <col className="w-[6%]" />
                </colgroup>

                <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="border-b border-slate-200 px-3 py-2 text-left">
                      Naam
                    </th>
                    <th className="border-b border-slate-200 px-2 py-2 text-left">
                      Periode
                    </th>
                    <th className="border-b border-slate-200 px-1 py-2 text-center">
                      Max
                    </th>

                    {dagen.map((dag) => (
                      <React.Fragment key={dag}>
                        <th className="border-b border-slate-200 px-1 py-2 text-center">
                          {dagLabels[dag]}1
                        </th>
                        <th className="border-b border-slate-200 px-1 py-2 text-center">
                          {dagLabels[dag]}2
                        </th>
                      </React.Fragment>
                    ))}

                    <th className="pdf-hide border-b border-slate-200 px-1 py-2 text-center">
                      Actie
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {data.map((regel) => (
                    <tr key={regel.id} className="hover:bg-slate-50">
                      <td
                        className="px-3 py-2 font-semibold text-slate-950"
                        title={
                          regel.opmerkingen
                            ? `${regel.naam} – ${regel.opmerkingen}`
                            : regel.naam
                        }
                      >
                        <div className="whitespace-normal leading-tight">{regel.naam}</div>
                      </td>

                      <td className="whitespace-nowrap px-2 py-2 text-slate-700">
                        {new Date(regel.startdatum).toLocaleDateString("nl-NL", {
                          day: "numeric",
                          month: "numeric",
                          year: "2-digit",
                        })}{" "}
                        –{" "}
                        {new Date(regel.einddatum).toLocaleDateString("nl-NL", {
                          day: "numeric",
                          month: "numeric",
                          year: "2-digit",
                        })}
                      </td>

                      <td className="px-1 py-2 text-center whitespace-nowrap">
                        <span className="inline-flex min-w-6 justify-center rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700 ring-1 ring-blue-100">
                          {regel.max_shifts_per_week}
                        </span>
                      </td>

                      {dagen.map((dag) => (
                        <React.Fragment key={`${regel.id}-${dag}`}>
                          <td className="px-1 py-2 text-center">
                            {regel[`${dag}_1`] ? (
                              <span className="text-emerald-600 font-bold">✓</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>

                          <td className="px-1 py-2 text-center">
                            {regel[`${dag}_2`] ? (
                              <CheckCircle2 className="mx-auto h-4 w-4 text-emerald-600" />
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                        </React.Fragment>
                      ))}

                      <td className="px-1 py-2 text-center print:hidden">
                        <button
                          onClick={() => handleDelete(regel.id)}
                          className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                          title="Verwijderen"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}

                  <tr className="bg-blue-50 font-bold text-blue-950">
                    <td className="px-3 py-2">Totaal beschikbaar</td>
                    <td className="px-2 py-2 text-slate-500">Per shift</td>
                    <td className="px-1 py-2 text-center">—</td>

                    {dagen.map((dag) => (
                      <React.Fragment key={`totaal-${dag}`}>
                        <td className="px-1 py-2 text-center">
                          {totalen[dag].s1}
                        </td>
                        <td className="px-1 py-2 text-center">
                          {totalen[dag].s2}
                        </td>
                      </React.Fragment>
                    ))}

                    <td className="px-1 py-2 print:hidden" />
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}