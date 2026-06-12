"use client";

import useSWR from "swr";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  CloudSun,
  Loader2,
  ShieldCheck,
  Users,
} from "lucide-react";

type DashboardItem = {
  titel: string;
  waarde: string | number | null;
  subtitel: string;
  href?: string;
  status?: "goed" | "waarschuwing" | "neutraal" | "onbekend";
};

type DashboardData = {
  datumLabel: string;
  bijgewerktOp: string;
  items: {
    weer: DashboardItem;
    medewerkers: DashboardItem;
    openShifts: DashboardItem;
    haccp: DashboardItem;
    productie: DashboardItem;
  };
};

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const iconen = {
  weer: CloudSun,
  medewerkers: Users,
  openShifts: CalendarDays,
  haccp: ShieldCheck,
  productie: ChefHat,
} as const;

const kleurClass = {
  goed: "border-emerald-200 bg-emerald-50 text-emerald-800",
  waarschuwing: "border-amber-200 bg-amber-50 text-amber-800",
  neutraal: "border-blue-200 bg-blue-50 text-blue-800",
  onbekend: "border-slate-200 bg-slate-50 text-slate-600",
};

function waardeTekst(waarde: string | number | null) {
  if (waarde === null || waarde === undefined || waarde === "") return "—";
  return String(waarde);
}

function titelFallback(key: string) {
  const titels: Record<string, string> = {
    weer: "Weer & terras",
    medewerkers: "Medewerkers vandaag",
    openShifts: "Open shifts",
    haccp: "HACCP",
    productie: "Productie",
  };
  return titels[key] || key;
}

export default function VandaagDashboard() {
  const { data, error, isLoading } = useSWR<DashboardData>(
    "/api/admin/dashboard/vandaag",
    fetcher,
    { refreshInterval: 5 * 60 * 1000 }
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-sm font-semibold text-blue-600">Vandaag</div>
            <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
              Dagsturing Vincenzo
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {data?.datumLabel || "Actuele stand van de dagelijkse operatie."}
            </p>
          </div>

          <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium text-slate-500">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            {data?.bijgewerktOp ? `Bijgewerkt ${data.bijgewerktOp}` : "Wordt geladen"}
          </div>
        </div>
      </div>

      {error ? (
        <div className="m-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Dashboardgegevens konden niet geladen worden.
          </div>
        </div>
      ) : (
        <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-5">
          {(Object.keys(iconen) as Array<keyof typeof iconen>).map((key) => {
            const Icon = iconen[key];
            const item = data?.items?.[key];
            const status = item?.status || "onbekend";
            const inhoud = (
              <div className="flex h-full min-h-40 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-700">
                      {item?.titel || titelFallback(key)}
                    </div>
                    <div className="mt-2 text-3xl font-bold tracking-tight text-slate-950">
                      {isLoading ? "…" : waardeTekst(item?.waarde ?? null)}
                    </div>
                  </div>
                  <div className={`rounded-xl border p-2 ${kleurClass[status]}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>

                <p className="mt-3 text-sm leading-5 text-slate-500">
                  {item?.subtitel || "Nog niet gekoppeld."}
                </p>
              </div>
            );

            return item?.href ? (
              <Link key={key} href={item.href} className="block h-full">
                {inhoud}
              </Link>
            ) : (
              <div key={key} className="h-full">
                {inhoud}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
