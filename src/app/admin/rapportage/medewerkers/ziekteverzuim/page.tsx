// src/app/admin/rapportages/ziekteverzuim/page.tsx

"use client";

import Link from "next/link";
import useSWR from "swr";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { useMemo, useState } from "react";
import ScrollToTopButton from "@/components/ScrollToTopButton";
import {
  Activity,
  ArrowUpDown,
  HeartPulse,
  Users,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const formatDate = (dateStr: string) => {
  try {
    return format(new Date(dateStr), "d MMMM yyyy", { locale: nl });
  } catch {
    return dateStr;
  }
};

interface VerzuimItem {
  id: number;
  medewerker_naam: string;
  van: string;
  tot: string | null;
  opmerking: string;
}

export default function ZiekteverzuimRapportage() {
  const { data: verzuim } = useSWR<VerzuimItem[]>(
    "/api/admin/rapportage/ziekteverzuim",
    fetcher
  );

  const [sortering, setSortering] = useState<
    "aantal" | "standaard"
  >("standaard");

  const gegroepeerd = useMemo(() => {
    const map: { [naam: string]: VerzuimItem[] } = {};

    verzuim?.forEach((v) => {
      if (!map[v.medewerker_naam]) {
        map[v.medewerker_naam] = [];
      }

      map[v.medewerker_naam].push(v);
    });

    return map;
  }, [verzuim]);

  const totaalMeldingen = verzuim?.length || 0;

  const openMeldingen =
    verzuim?.filter((v) => !v.tot).length || 0;

  const medewerkersAantal = Object.keys(gegroepeerd).length;

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Link
            href="/admin/rapportage/medewerkers"
            className="text-sm text-blue-700 hover:underline"
          >
            ← Terug naar rapportage medewerkers
          </Link>

          <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                <HeartPulse size={14} />
                Personeel
              </div>

              <h1 className="text-2xl font-bold text-slate-900">
                Ziekteverzuimrapportage
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Overzicht van ziekmeldingen en open verzuimdossiers.
              </p>
            </div>

            <button
              onClick={() =>
                setSortering((s) =>
                  s === "standaard"
                    ? "aantal"
                    : "standaard"
                )
              }
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <ArrowUpDown size={16} />
              {sortering === "standaard"
                ? "Sorteer op aantal meldingen"
                : "Sorteer op open meldingen"}
            </button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <KpiCard
            titel="Totale meldingen"
            waarde={String(totaalMeldingen)}
            icon={<Activity size={18} />}
            kleur="blue"
          />

          <KpiCard
            titel="Open ziekmeldingen"
            waarde={String(openMeldingen)}
            icon={<HeartPulse size={18} />}
            kleur="red"
          />

          <KpiCard
            titel="Medewerkers"
            waarde={String(medewerkersAantal)}
            icon={<Users size={18} />}
            kleur="emerald"
          />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span className="font-semibold">
              Huidige sortering:
            </span>

            <span className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-700">
              {sortering === "standaard"
                ? "Open meldingen + alfabetisch"
                : "Aantal ziekmeldingen hoog → laag"}
            </span>
          </div>
        </section>

        {!verzuim ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            Laden...
          </div>
        ) : verzuim.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            Geen meldingen gevonden.
          </div>
        ) : (
          Object.entries(gegroepeerd)
            .sort(([aNaam, aM], [bNaam, bM]) => {
              if (sortering === "aantal") {
                return (
                  bM.length - aM.length ||
                  aNaam.localeCompare(bNaam)
                );
              } else {
                const aOpen = aM.some((m) => !m.tot);
                const bOpen = bM.some((m) => !m.tot);

                if (aOpen === bOpen) {
                  return aNaam.localeCompare(bNaam);
                }

                return aOpen ? -1 : 1;
              }
            })
            .map(([naam, meldingen]) => {
              const open = meldingen.some((m) => !m.tot);

              return (
                <section
                  key={naam}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-5 py-4">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">
                        {naam}
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        {meldingen.length} ziekmelding
                        {meldingen.length !== 1 ? "en" : ""}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-700">
                        {meldingen.length}
                      </span>

                      {open ? (
                        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                          Open melding
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                          Afgerond
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-200">
                        <tr>
                          <th className="px-4 py-3 text-left">
                            Van
                          </th>
                          <th className="px-4 py-3 text-left">
                            Tot
                          </th>
                          <th className="px-4 py-3 text-left">
                            Status
                          </th>
                          <th className="px-4 py-3 text-left">
                            Opmerking
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {meldingen.map((v) => (
                          <tr
                            key={v.id}
                            className="border-t border-slate-200 hover:bg-slate-50"
                          >
                            <td className="px-4 py-3 font-medium text-slate-900">
                              {formatDate(v.van)}
                            </td>

                            <td className="px-4 py-3 text-slate-700">
                              {v.tot
                                ? formatDate(v.tot)
                                : "—"}
                            </td>

                            <td className="px-4 py-3">
                              {!v.tot ? (
                                <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
                                  Nog ziekgemeld
                                </span>
                              ) : (
                                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                                  Afgerond
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3 text-slate-700">
                              {v.opmerking || "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })
        )}

        <ScrollToTopButton />
      </div>
    </main>
  );
}

function KpiCard({
  titel,
  waarde,
  icon,
  kleur,
}: {
  titel: string;
  waarde: string;
  icon: React.ReactNode;
  kleur: "blue" | "red" | "emerald";
}) {
  const styles = {
    blue: "bg-blue-50 border-blue-200 text-blue-900",
    red: "bg-red-50 border-red-200 text-red-900",
    emerald:
      "bg-emerald-50 border-emerald-200 text-emerald-900",
  };

  return (
    <div
      className={`rounded-2xl border p-5 shadow-sm ${styles[kleur]}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium opacity-80">
          {titel}
        </p>

        <div className="opacity-70">{icon}</div>
      </div>

      <p className="mt-3 text-3xl font-bold">{waarde}</p>
    </div>
  );
}