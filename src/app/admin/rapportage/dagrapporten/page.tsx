"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatEuro(value: number | null) {
  if (value === null || value === undefined) return "-";

  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

function formatDatum(value: string) {
  return new Date(value).toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function DagrapportenPage() {
  const [datum, setDatum] = useState(
    new Date().toISOString().slice(0, 10)
  );

  const { data, error, isLoading } = useSWR(
    `/api/admin/dagrapporten?datum=${datum}`,
    fetcher
  );

  const rapport = data?.rapport;

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Link
            href="/admin/rapportage"
            className="text-sm text-blue-700 hover:underline"
          >
            ← Terug naar rapportages
          </Link>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Dagrapporten
              </h1>
              <p className="text-sm text-slate-500">
                Bekijk opgeslagen dagrapportages.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Datum
              </label>

              <input
                type="date"
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        {isLoading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            Laden...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700 shadow-sm">
            Fout bij laden van rapport.
          </div>
        )}

        {!isLoading && data?.gevonden === false && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-slate-600">
              Geen opgeslagen dagrapport gevonden voor deze datum.
            </p>
          </div>
        )}

        {rapport && (
          <>
            <div className="grid gap-4 md:grid-cols-4">
              <InfoCard
                titel="Datum"
                waarde={formatDatum(rapport.datum)}
              />

              <InfoCard
                titel="Dagomzet"
                waarde={formatEuro(rapport.dagomzet)}
              />

              <InfoCard
                titel="Gemaakt op"
                waarde={new Date(rapport.gemaakt_op).toLocaleString("nl-NL")}
              />

              <InfoCard
                titel="Bijgewerkt op"
                waarde={new Date(rapport.bijgewerkt_op).toLocaleString(
                  "nl-NL"
                )}
              />
            </div>

            {rapport.weer_json && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-900">
                  Weer
                </h2>

                <div className="grid gap-4 md:grid-cols-4">
                  <InfoCard
                    titel="Omschrijving"
                    waarde={rapport.weer_json.omschrijving || "-"}
                  />

                  <InfoCard
                    titel="Min temperatuur"
                    waarde={
                      rapport.weer_json.minTemp !== null
                        ? `${rapport.weer_json.minTemp}°C`
                        : "-"
                    }
                  />

                  <InfoCard
                    titel="Max temperatuur"
                    waarde={
                      rapport.weer_json.maxTemp !== null
                        ? `${rapport.weer_json.maxTemp}°C`
                        : "-"
                    }
                  />

                  <InfoCard
                    titel="Neerslag"
                    waarde={
                      rapport.weer_json.neerslag !== null
                        ? `${rapport.weer_json.neerslag} mm`
                        : "-"
                    }
                  />
                </div>
              </div>
            )}

            {Array.isArray(rapport.omzet_per_uur_json) && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-900">
                  Omzet per uur
                </h2>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="px-3 py-2 text-left">Uur</th>
                        <th className="px-3 py-2 text-right">Omzet</th>
                      </tr>
                    </thead>

                    <tbody>
                      {rapport.omzet_per_uur_json.map(
                        (
                          item: {
                            uur: string;
                            omzet: number;
                          },
                          index: number
                        ) => (
                          <tr
                            key={index}
                            className="border-t border-slate-200"
                          >
                            <td className="px-3 py-2">{item.uur}</td>
                            <td className="px-3 py-2 text-right">
                              {formatEuro(item.omzet)}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {rapport.html && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-4 text-lg font-bold text-slate-900">
                  Volledig rapport
                </h2>

                <div
                  className="prose max-w-none"
                  dangerouslySetInnerHTML={{ __html: rapport.html }}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function InfoCard({
  titel,
  waarde,
}: {
  titel: string;
  waarde: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{titel}</p>
      <p className="mt-2 text-base font-semibold text-slate-900">
        {waarde}
      </p>
    </div>
  );
}