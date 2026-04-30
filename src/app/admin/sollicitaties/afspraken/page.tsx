"use client";

import * as React from "react";
import useSWR from "swr";
import {
  CalendarClock,
  Loader2,
  RefreshCw,
  UserRound,
} from "lucide-react";

type Afspraak = {
  id: number;
  naam: string;
  email: string;
  starttijd: string;
  eindtijd: string;
  status: string;
  calendly_uri: string;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("nl-NL", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AfsprakenPage() {
  const [loading, setLoading] = React.useState(false);

  const { data, error, mutate } = useSWR<Afspraak[]>(
    "/api/calendly/afspraken",
    fetcher
  );

  const totaal = data?.length ?? 0;
  const actief = data?.filter((a) => a.status !== "canceled").length ?? 0;

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-600">
                <CalendarClock className="h-4 w-4" />
                Sollicitaties / Afspraken
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Sollicitatiegesprekken
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Overzicht van geplande gesprekken uit Calendly.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-xl bg-blue-50 px-4 py-3 ring-1 ring-blue-100">
                <div className="text-xs font-medium uppercase tracking-wide text-blue-600">
                  Totaal
                </div>
                <div className="text-2xl font-bold text-blue-950">{totaal}</div>
              </div>

              <div className="rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
                <div className="text-xs font-medium uppercase tracking-wide text-emerald-600">
                  Actief
                </div>
                <div className="text-2xl font-bold text-emerald-950">
                  {actief}
                </div>
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={async () => {
                  setLoading(true);
                  try {
                    const res = await fetch("/api/calendly/sync", {
                      method: "POST",
                    });

                    if (!res.ok) {
                      alert("Synchroniseren mislukt");
                      return;
                    }

                    await mutate();
                  } finally {
                    setLoading(false);
                  }
                }}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Bezig...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4" />
                    Verversen
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
            Afspraken konden niet worden geladen.
          </div>
        )}

        {!data && !error && (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
            <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />
            <p className="text-sm text-slate-500">Afspraken laden…</p>
          </div>
        )}

        {data && data.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-500 shadow-sm">
            Nog geen afspraken gevonden.
          </div>
        )}

        {data && data.length > 0 && (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                  <UserRound size={20} />
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-950">
                    Gesprekken
                  </h2>
                  <p className="text-sm text-slate-500">
                    Meest recent gesynchroniseerde afspraken.
                  </p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="border-b border-slate-200 px-4 py-3 text-left">
                      Naam
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-left">
                      Email
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-left">
                      Start
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-left">
                      Status
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {data.map((a) => {
                    const isCanceled = a.status === "canceled";

                    return (
                      <tr key={a.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-950">
                          {a.naam}
                        </td>

                        <td className="px-4 py-3 text-slate-600">{a.email}</td>

                        <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800">
                          {formatDateTime(a.starttijd)}
                        </td>

                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                              isCanceled
                                ? "bg-red-50 text-red-700 ring-red-200"
                                : "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            }`}
                          >
                            {a.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}