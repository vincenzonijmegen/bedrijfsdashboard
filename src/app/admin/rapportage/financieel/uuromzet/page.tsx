"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const weekdagNL = (datumStr: string) => {
  const dag = new Date(datumStr);

  return dag.toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
};

type DagUurOmzet = {
  dag: string;
  uur: string;
  omzet: number;
};

function formatEuro(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function UurOmzetPage() {
  const vandaag = new Date().toISOString().slice(0, 10);

  const [start, setStart] = useState(vandaag);
  const [end, setEnd] = useState(vandaag);

  const [data, setData] = useState<DagUurOmzet[]>([]);
  const [uren, setUren] = useState<string[]>([]);
  const [dagen, setDagen] = useState<string[]>([]);

  useEffect(() => {
    if (!start || !end) return;

    fetch(`/api/rapportage/uuromzet?start=${start}&end=${end}`)
      .then((res) => res.json())
      .then((rows: DagUurOmzet[]) => {
        setData(rows);
        setDagen([...new Set(rows.map((r) => r.dag))]);
        setUren([...new Set(rows.map((r) => r.uur))].sort());
      });
  }, [start, end]);

  const maxOmzet = Math.max(...data.map((d) => d.omzet), 1);

  const kolomTotalen = uren.map((uur) =>
    data
      .filter((d) => d.uur === uur)
      .reduce((sum, d) => sum + Number(d.omzet), 0)
  );

  const totaalAll = kolomTotalen.reduce((sum, v) => sum + Number(v), 0);

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-[1800px] space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Link
            href="/admin/rapportage/financieel"
            className="text-sm text-blue-700 hover:underline"
          >
            ← Financiële Rapportages
          </Link>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Uur-omzet per dag
              </h1>

              <p className="text-sm text-slate-500">
                Analyse van omzetverdeling per uur met heatmap-weergave.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Van
                </label>

                <input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Tot
                </label>

                <input
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">
              Omzetmatrix
            </h2>
          </div>

          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-100">
                <tr>
                  <th className="sticky left-0 z-20 border-b border-slate-200 bg-slate-100 px-3 py-3 text-left font-semibold text-slate-700">
                    Datum
                  </th>

                  {uren.map((uur) => (
                    <th
                      key={uur}
                      className="border-b border-slate-200 px-3 py-3 text-center font-semibold text-slate-700"
                    >
                      {uur}
                    </th>
                  ))}

                  <th className="border-b border-slate-200 px-3 py-3 text-right font-semibold text-slate-700">
                    Totaal
                  </th>
                </tr>
              </thead>

              <tbody>
                {dagen.map((dag) => {
                  const bedragen = uren.map((uur) => {
                    const found = data.find(
                      (d) => d.dag === dag && d.uur === uur
                    );

                    return found ? Number(found.omzet) : 0;
                  });

                  const rijTotaal = bedragen.reduce(
                    (sum, x) => sum + x,
                    0
                  );

                  return (
                    <tr
                      key={dag}
                      className="border-b border-slate-100 hover:bg-slate-50"
                    >
                      <td className="sticky left-0 bg-white px-3 py-2 font-semibold text-slate-800">
                        {weekdagNL(dag)}
                      </td>

                      {bedragen.map((omzet, idx) => (
                        <td
                          key={idx}
                          className="px-3 py-2 text-right text-slate-700"
                        >
                          {omzet > 0 ? formatEuro(omzet) : "-"}
                        </td>
                      ))}

                      <td className="bg-slate-50 px-3 py-2 text-right font-bold text-slate-900">
                        {rijTotaal > 0 ? formatEuro(rijTotaal) : "-"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              <tfoot className="bg-slate-100">
                <tr>
                  <td className="px-3 py-3 font-bold text-slate-900">
                    Totaal
                  </td>

                  {kolomTotalen.map((totaal, idx) => (
                    <td
                      key={idx}
                      className="px-3 py-3 text-right font-bold text-slate-900"
                    >
                      {totaal > 0 ? formatEuro(totaal) : "-"}
                    </td>
                  ))}

                  <td className="px-3 py-3 text-right font-bold text-slate-900">
                    {totaalAll > 0 ? formatEuro(totaalAll) : "-"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {dagen.length > 0 && uren.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="text-lg font-bold text-slate-900">
                Heatmap omzet per uur
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Donkerder blauw betekent hogere omzet.
              </p>
            </div>

            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="sticky left-0 z-20 border-b border-slate-200 bg-slate-100 px-3 py-3 text-left font-semibold text-slate-700">
                      Datum
                    </th>

                    {uren.map((uur) => (
                      <th
                        key={uur}
                        className="border-b border-slate-200 px-3 py-3 text-center font-semibold text-slate-700"
                      >
                        {uur}
                      </th>
                    ))}

                    <th className="border-b border-slate-200 px-3 py-3 text-right font-semibold text-slate-700">
                      Totaal
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {dagen.map((dag) => {
                    const bedragen = uren.map((uur) => {
                      const found = data.find(
                        (d) => d.dag === dag && d.uur === uur
                      );

                      return found ? Number(found.omzet) : 0;
                    });

                    const rijTotaal = bedragen.reduce(
                      (sum, x) => sum + x,
                      0
                    );

                    return (
                      <tr
                        key={dag}
                        className="border-b border-slate-100"
                      >
                        <td className="sticky left-0 bg-white px-3 py-2 font-semibold text-slate-800">
                          {weekdagNL(dag)}
                        </td>

                        {bedragen.map((omzet, idx) => {
                          const intensity =
                            omzet === 0
                              ? 0
                              : Math.min(1, omzet / maxOmzet);

                          const background =
                            omzet === 0
                              ? "rgba(148,163,184,0.08)"
                              : `rgba(37,99,235,${
                                  0.12 + intensity * 0.55
                                })`;

                          const textColor =
                            intensity > 0.55 ? "#ffffff" : "#0f172a";

                          return (
                            <td
                              key={idx}
                              className="px-3 py-2 text-right font-medium transition-colors"
                              style={{
                                backgroundColor: background,
                                color: textColor,
                              }}
                            >
                              {omzet > 0
                                ? formatEuro(omzet)
                                : "-"}
                            </td>
                          );
                        })}

                        <td className="bg-slate-50 px-3 py-2 text-right font-bold text-slate-900">
                          {rijTotaal > 0
                            ? formatEuro(rijTotaal)
                            : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>

                <tfoot className="bg-slate-100">
                  <tr>
                    <td className="px-3 py-3 font-bold text-slate-900">
                      Totaal
                    </td>

                    {kolomTotalen.map((totaal, idx) => (
                      <td
                        key={idx}
                        className="px-3 py-3 text-right font-bold text-slate-900"
                      >
                        {totaal > 0
                          ? formatEuro(totaal)
                          : "-"}
                      </td>
                    ))}

                    <td className="px-3 py-3 text-right font-bold text-slate-900">
                      {totaalAll > 0
                        ? formatEuro(totaalAll)
                        : "-"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}