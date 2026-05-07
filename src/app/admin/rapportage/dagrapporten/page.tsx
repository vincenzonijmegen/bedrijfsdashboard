"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatEuro(value: number | null) {
  if (value === null || value === undefined) return "Gesloten";

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

function getTemperatuurClass(value: number | null | undefined) {
  if (value === null || value === undefined) return "border-slate-200 bg-white";

  if (value < 5) return "border-blue-200 bg-blue-50 text-blue-900";
  if (value < 12) return "border-sky-200 bg-sky-50 text-sky-900";
  if (value < 20) return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (value < 28) return "border-orange-200 bg-orange-50 text-orange-900";

  return "border-red-200 bg-red-50 text-red-900";
}

function getNeerslagClass(value: number | null | undefined) {
  if (value === null || value === undefined) return "border-slate-200 bg-white";

  if (value === 0) return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (value < 2) return "border-sky-200 bg-sky-50 text-sky-900";
  if (value < 8) return "border-blue-200 bg-blue-50 text-blue-900";

  return "border-indigo-200 bg-indigo-50 text-indigo-900";
}

function getWeerClass(omschrijving: string | null | undefined) {
  const weer = String(omschrijving || "").toLowerCase();

  if (weer.includes("zonnig")) {
    return "border-yellow-200 bg-yellow-50 text-yellow-900";
  }

  if (
    weer.includes("regen") ||
    weer.includes("bui") ||
    weer.includes("onweer") ||
    weer.includes("hagel")
  ) {
    return "border-blue-200 bg-blue-50 text-blue-900";
  }

  if (weer.includes("bewolkt") || weer.includes("mist")) {
    return "border-slate-200 bg-slate-50 text-slate-900";
  }

  return "border-slate-200 bg-white text-slate-900";
}

export default function DagrapportenPage() {
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10));

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
              <InfoCard titel="Datum" waarde={formatDatum(rapport.datum)} />

              <InfoCard
                titel="Dagomzet"
                waarde={formatEuro(rapport.dagomzet)}
                className={
                  rapport.dagomzet === null
                    ? "border-slate-200 bg-slate-50 text-slate-700"
                    : "border-emerald-200 bg-emerald-50 text-emerald-900"
                }
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
                <h2 className="mb-4 text-lg font-bold text-slate-900">Weer</h2>

                <div className="grid gap-4 md:grid-cols-4">
                  <InfoCard
                    titel="Omschrijving"
                    waarde={rapport.weer_json.omschrijving || "-"}
                    className={getWeerClass(rapport.weer_json.omschrijving)}
                  />

                  <InfoCard
                    titel="Min temperatuur"
                    waarde={
                      rapport.weer_json.minTemp !== null &&
                      rapport.weer_json.minTemp !== undefined
                        ? `${rapport.weer_json.minTemp}°C`
                        : "-"
                    }
                    className={getTemperatuurClass(rapport.weer_json.minTemp)}
                  />

                  <InfoCard
                    titel="Max temperatuur"
                    waarde={
                      rapport.weer_json.maxTemp !== null &&
                      rapport.weer_json.maxTemp !== undefined
                        ? `${rapport.weer_json.maxTemp}°C`
                        : "-"
                    }
                    className={getTemperatuurClass(rapport.weer_json.maxTemp)}
                  />

                  <InfoCard
                    titel="Neerslag"
                    waarde={
                      rapport.weer_json.neerslag !== null &&
                      rapport.weer_json.neerslag !== undefined
                        ? `${rapport.weer_json.neerslag} mm`
                        : "-"
                    }
                    className={getNeerslagClass(rapport.weer_json.neerslag)}
                  />
                </div>
              </div>
            )}

            {rapport.dagomzet === null && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="mb-2 text-lg font-bold text-slate-900">
                  Omzet per uur
                </h2>
                <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Gesloten / geen omzet geregistreerd voor deze datum.
                </p>
              </div>
            )}

            {rapport.dagomzet !== null &&
              Array.isArray(rapport.omzet_per_uur_json) && (
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
                        {(() => {
                          const omzetUren = rapport.omzet_per_uur_json as {
                            uur: string;
                            omzet: number;
                          }[];

                          const maxOmzet = Math.max(
                            ...omzetUren.map((item) =>
                              Number(item.omzet || 0)
                            ),
                            0
                          );

                          return omzetUren.map((item, index: number) => (
                            <tr
                              key={index}
                              className="border-t border-slate-200"
                              style={{
                                backgroundColor:
                                  maxOmzet > 0
                                    ? `rgba(37, 99, 235, ${
                                        0.08 +
                                        (Number(item.omzet || 0) / maxOmzet) *
                                          0.22
                                      })`
                                    : undefined,
                              }}
                            >
                              <td className="px-3 py-2">{item.uur}</td>
                              <td className="px-3 py-2 text-right">
                                {formatEuro(item.omzet)}
                              </td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            {Array.isArray(rapport.haccp_json) &&
              rapport.haccp_json.length === 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-2 text-lg font-bold text-slate-900">
                    HACCP routines
                  </h2>
                  <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
                    Geen HACCP routines opgeslagen voor deze datum.
                  </p>
                </div>
              )}

            {Array.isArray(rapport.haccp_json) &&
              rapport.haccp_json.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-4 text-lg font-bold text-slate-900">
                    HACCP routines
                  </h2>

                  <div className="space-y-4">
                    {rapport.haccp_json.map((routine: any, index: number) => (
                      <div
                        key={index}
                        className="rounded-xl border border-slate-200 p-4"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <h3 className="font-semibold text-slate-900">
                              {routine.routineNaam}
                            </h3>

                            <p className="text-sm text-slate-500">
                              {routine.gedaanTaken} / {routine.totaalTaken}{" "}
                              afgerond
                            </p>
                          </div>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-semibold ${
                              routine.compleet
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {routine.compleet ? "Compleet" : "Incompleet"}
                          </span>
                        </div>

                        {!routine.compleet && (
                          <div className="mt-4">
                            <p className="mb-2 text-sm font-semibold text-slate-700">
                              Openstaande taken
                            </p>

                            <div className="space-y-1">
                              {routine.taken
                                .filter((taak: any) => !taak.afgetekend)
                                .map((taak: any, taakIndex: number) => (
                                  <div
                                    key={taakIndex}
                                    className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
                                  >
                                    {taak.taakNaam}
                                  </div>
                                ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {Array.isArray(rapport.productie_json) &&
              rapport.productie_json.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-4 text-lg font-bold text-slate-900">
                    Productie
                  </h2>

                  <div className="space-y-4">
                    {rapport.productie_json.map(
                      (categorie: any, index: number) => (
                        <div
                          key={index}
                          className="rounded-xl border border-slate-200 p-4"
                        >
                          <div className="mb-3 flex items-center justify-between">
                            <h3 className="font-semibold text-slate-900">
                              {categorie.categorie}
                            </h3>

                            <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                              {categorie.totaal} totaal
                            </span>
                          </div>

                          <div className="space-y-1">
                            {categorie.items.map(
                              (item: any, itemIndex: number) => (
                                <div
                                  key={itemIndex}
                                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
                                >
                                  <span>{item.naam}</span>
                                  <span className="font-semibold">
                                    {item.aantal}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                </div>
              )}

            {Array.isArray(rapport.rotaties_json) &&
              rapport.rotaties_json.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h2 className="mb-4 text-lg font-bold text-slate-900">
                    Laatste rotaties
                  </h2>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-100">
                        <tr>
                          <th className="px-3 py-2 text-left">Datum</th>
                          <th className="px-3 py-2 text-left">Rotatie</th>
                          <th className="px-3 py-2 text-left">Taak</th>
                          <th className="px-3 py-2 text-left">
                            Afgetekend door
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {rapport.rotaties_json.map(
                          (rotatie: any, index: number) => (
                            <tr
                              key={index}
                              className="border-t border-slate-200"
                            >
                              <td className="px-3 py-2">{rotatie.datum}</td>
                              <td className="px-3 py-2">
                                {rotatie.rotatieNaam}
                              </td>
                              <td className="px-3 py-2">{rotatie.taakNaam}</td>
                              <td className="px-3 py-2">
                                {rotatie.afgetekendDoorNaam || "-"}
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
  className = "",
}: {
  titel: string;
  waarde: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${
        className || "border-slate-200 bg-white text-slate-900"
      }`}
    >
      <p className="text-sm font-medium opacity-70">{titel}</p>
      <p className="mt-2 text-base font-semibold">{waarde}</p>
    </div>
  );
}