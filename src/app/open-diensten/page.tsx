"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import Link from "next/link";
import {
  CalendarDays,
  Download,
  Home,
  Loader2,
  Users,
} from "lucide-react";
import ScrollToTopButton from "@/components/ScrollToTopButton";

type Dienst = {
  id: string;
  date: string;
  starttime: string;
  endtime: string;
  description: string;
  shift: {
    long_name: string;
    color: string;
  };
};

export default function OpenDienstenPerWeek() {
  const [data, setData] = useState<Dienst[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const today = new Date();
    const inFourWeeks = new Date();
    inFourWeeks.setDate(today.getDate() + 100);

    const min = today.toISOString().slice(0, 10);
    const max = inFourWeeks.toISOString().slice(0, 10);

    fetch(`/api/shiftbase/open-diensten?min_date=${min}&max_date=${max}`)
      .then((res) => res.json())
      .then((json) => {
        const diensten = (json.data || []).map((item: any) => ({
          ...item.OpenShift,
          shift: item.Shift,
        }));
        setData(diensten);
      })
      .finally(() => setLoading(false));
  }, []);

  const dienstenPerWeek = useMemo(() => {
    const grouped: Record<string, Dienst[]> = {};

    data.forEach((d) => {
      const week = getWeekNumber(d.date);
      if (!grouped[week]) grouped[week] = [];
      grouped[week].push(d);
    });

    return grouped;
  }, [data]);

  const exportToPDF = async () => {
  // @ts-expect-error: html2pdf.js heeft geen types
  const html2pdf = (await import("html2pdf.js")).default;
  const element = document.getElementById("pdf-content");
  if (!element) return;

  html2pdf()
    .set({
      margin: [0.35, 0.35, 0.35, 0.35],
      filename: "OpenDiensten.pdf",
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        scrollY: 0,
      },
      jsPDF: {
        unit: "in",
        format: "a4",
        orientation: "portrait",
      },
      pagebreak: {
        mode: ["css", "legacy"],
        avoid: [".pdf-week", "tr", "table"],
      },
    })
    .from(element)
    .save();
};
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 px-6 py-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Open diensten laden…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-600">
                <CalendarDays className="h-4 w-4" />
                Planning / Open diensten
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Open diensten per week
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Overzicht van alle open diensten voor de komende periode.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                href="/"
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                <Home size={16} />
                Start
              </Link>

              <button
                onClick={exportToPDF}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <Download size={16} />
                Download PDF
              </button>
            </div>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                <Users size={20} />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">
                  Open diensten
                </div>
                <div className="text-2xl font-bold text-slate-950">
                  {data.length}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                <CalendarDays size={20} />
              </div>
              <div>
                <div className="text-sm font-medium text-slate-500">Weken</div>
                <div className="text-2xl font-bold text-slate-950">
                  {Object.keys(dienstenPerWeek).length}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div
  id="pdf-content"
  className="space-y-5 bg-white p-4 text-slate-900"
>
          {Object.entries(dienstenPerWeek)
            .sort(([a], [b]) => Number(a) - Number(b))
            .map(([weekNr, diensten]) => (
              <section
  key={weekNr}
  className="pdf-week break-inside-avoid overflow-hidden rounded-lg border border-slate-200 bg-white"
  style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
>
                <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-950">
                      Week {weekNr}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {diensten.length} open dienst
                      {diensten.length === 1 ? "" : "en"}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="border-b border-slate-200 px-4 py-3 text-left">
                          Datum
                        </th>
                        <th className="border-b border-slate-200 px-4 py-3 text-left">
                          Dag
                        </th>
                        <th className="border-b border-slate-200 px-4 py-3 text-left">
                          Starttijd
                        </th>
                        <th className="border-b border-slate-200 px-4 py-3 text-left">
                          Eindtijd
                        </th>
                        <th className="border-b border-slate-200 px-4 py-3 text-center">
                          Dienst
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {diensten
                        .sort((a, b) => a.date.localeCompare(b.date))
                        .map((d) => (
                          <tr
  key={d.id}
  className="align-top"
  style={{ pageBreakInside: "avoid", breakInside: "avoid" }}
>
                            <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                              {format(parseISO(d.date), "dd-MM-yyyy")}
                            </td>

                            <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                              {format(parseISO(d.date), "eeee", {
                                locale: nl,
                              })}
                            </td>

                            <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-slate-900">
                              {d.starttime?.slice(0, 5)}
                            </td>

                            <td className="whitespace-nowrap px-4 py-3 font-semibold tabular-nums text-slate-900">
                              {d.endtime?.slice(0, 5)}
                            </td>

                            <td className="px-4 py-3 text-center">
                            <span
                              className="inline-flex min-w-[92px] justify-center rounded-full px-3 py-1 text-xs font-semibold text-white shadow-sm"
                              style={{
                                backgroundColor: d.shift?.color || "#999",
                              }}
                            >
                              {d.description || d.shift?.long_name}
                            </span>
                          </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}

          {data.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm text-slate-500 shadow-sm">
              Geen open diensten gevonden.
            </div>
          )}
        </div>

        <ScrollToTopButton />
      </div>
    </div>
  );
}

function getWeekNumber(isoDate: string): string {
  const date = parseISO(isoDate);
  const jan1 = new Date(date.getFullYear(), 0, 1);
  const days = Math.floor(
    (date.getTime() - jan1.getTime()) / (24 * 60 * 60 * 1000)
  );
  return String(Math.ceil((days + jan1.getDay() + 1) / 7));
}