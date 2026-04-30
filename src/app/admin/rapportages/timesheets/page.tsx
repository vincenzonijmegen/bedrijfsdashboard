"use client";

import { useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { AlertTriangle, Clock, Loader2 } from "lucide-react";

type Tijdregel = {
  id: string;
  date: string;
  starttime: string;
  endtime: string;
  user_id: string;
  user_name?: string;
  status: string;
  total: string;
};

export default function NietGoedgekeurdeUren() {
  const [data, setData] = useState<Tijdregel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const min = new Date();
    min.setDate(min.getDate() - 30);
    const minDate = min.toISOString().slice(0, 10);

    Promise.all([
      fetch(`/api/shiftbase/timesheets?min_date=${minDate}`).then((res) =>
        res.json()
      ),
      fetch(`/api/shiftbase/medewerkers`).then((res) =>
        res.ok ? res.json() : Promise.resolve({ data: [] })
      ),
    ]).then(([timesheetsRes, medewerkersRes]) => {
      const medewerkers = Array.isArray(medewerkersRes?.data)
        ? Object.fromEntries(
            medewerkersRes.data
              .filter((m: any) => m.fullName !== "Anonymous User")
              .map((m: any) => [m.id, m.fullName])
          )
        : {};

      const regels = (timesheetsRes.data || [])
        .map((item: any) => item.Timesheet)
        .filter((r: any) => r.status !== "Approved" && r.status !== "Declined")
        .map((r: any) => ({
          id: r.id,
          date: r.date,
          starttime: r.starttime,
          endtime: r.endtime,
          user_id: r.user_id,
          user_name: medewerkers[r.user_id] || r.user_id,
          status: r.status,
          total: r.total,
        }));

      setData(regels);
      setLoading(false);
    });
  }, []);

  const totalIssues = data.length;

  const opvallend = useMemo(
    () =>
      data.filter((r) => {
        const totalNum = parseFloat(r.total);
        return totalNum === 0 || (totalNum > 0 && totalNum < 2) || totalNum > 7;
      }).length,
    [data]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 px-6 py-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Uren laden…</p>
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
                <Clock className="h-4 w-4" />
                Planning / Urencontrole
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Niet-goedgekeurde uren
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Controle van Shiftbase-uren van de afgelopen 30 dagen.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-blue-50 px-4 py-3 ring-1 ring-blue-100">
                <div className="text-xs font-medium uppercase tracking-wide text-blue-600">
                  Open
                </div>
                <div className="text-2xl font-bold text-blue-950">
                  {totalIssues}
                </div>
              </div>

              <div className="rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-amber-100">
                <div className="text-xs font-medium uppercase tracking-wide text-amber-700">
                  Opvallend
                </div>
                <div className="text-2xl font-bold text-amber-950">
                  {opvallend}
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-950">
              Te controleren regels
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Paars = 0 uur, rood = korter dan 2 uur of langer dan 7 uur.
            </p>
          </div>

          {data.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">
              Geen niet-goedgekeurde uren gevonden.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="border-b border-slate-200 px-4 py-3 text-left">
                      Datum
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-left">
                      Medewerker
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-left">
                      Start
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-left">
                      Einde
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-left">
                      Totaal
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-left">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {data.map((r) => {
                    const totalNum = parseFloat(r.total);
                    let totalClass =
                      "bg-slate-50 text-slate-700 ring-slate-200";

                    if (totalNum === 0) {
                      totalClass =
                        "bg-purple-50 text-purple-800 ring-purple-200";
                    } else if (totalNum > 0 && totalNum < 2) {
                      totalClass = "bg-red-50 text-red-700 ring-red-200";
                    } else if (totalNum > 7) {
                      totalClass = "bg-red-600 text-white ring-red-600";
                    }

                    return (
                      <tr key={r.id} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-900">
                          {format(parseISO(r.date), "dd-MM-yyyy", {
                            locale: nl,
                          })}
                        </td>

                        <td className="px-4 py-3 font-semibold text-slate-900">
                          {r.user_name}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-700">
                          {r.starttime?.slice(0, 5)}
                        </td>

                        <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-700">
                          {r.endtime?.slice(0, 5)}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ring-1 ${totalClass}`}
                          >
                            {(totalNum || 0).toFixed(2)} uur
                            {(totalNum === 0 ||
                              (totalNum > 0 && totalNum < 2) ||
                              totalNum > 7) && (
                              <AlertTriangle className="h-3 w-3" />
                            )}
                          </span>
                        </td>

                        <td className="px-4 py-3">
                          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                            {r.status || "Onbekend"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}