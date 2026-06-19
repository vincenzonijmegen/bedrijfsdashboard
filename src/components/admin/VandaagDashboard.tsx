"use client";

import useSWR from "swr";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChefHat,
  CloudSun,
  HeartPulse,
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

type VerzuimItem = {
  id: number;
  medewerker_naam: string;
  van: string;
  tot: string | null;
  opmerking?: string | null;
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

function datumNl(datum: string) {
  if (!datum) return "onbekend";

  return new Date(datum).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function DashboardRij({
  titel,
  waarde,
  subtitel,
  status,
  icon: Icon,
  isLoading,
}: {
  titel: string;
  waarde: string | number | null;
  subtitel: React.ReactNode;
  status: "goed" | "waarschuwing" | "neutraal" | "onbekend";
  icon: React.ElementType;
  isLoading?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:shadow-md">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <div className={`shrink-0 rounded-xl border p-2 ${kleurClass[status]}`}>
            <Icon className="h-5 w-5" />
          </div>

          <div className="min-w-0">
            <div className="text-sm font-semibold text-slate-700">{titel}</div>

            <div className="mt-1 text-2xl font-bold tracking-tight text-slate-950">
              {isLoading ? "…" : waardeTekst(waarde)}
            </div>
          </div>
        </div>

        <div className="min-w-0 text-sm leading-5 text-slate-500 md:max-w-2xl md:text-right">
          {subtitel}
        </div>
      </div>
    </div>
  );
}

export default function VandaagDashboard() {
  const { data, error, isLoading } = useSWR<DashboardData>(
    "/api/admin/dashboard/vandaag",
    fetcher,
    { refreshInterval: 5 * 60 * 1000 }
  );

  const {
    data: verzuim,
    error: verzuimError,
    isLoading: verzuimLoading,
  } = useSWR<VerzuimItem[]>("/api/admin/rapportage/ziekteverzuim", fetcher, {
    refreshInterval: 5 * 60 * 1000,
  });

  const openZiekmeldingen = (verzuim || []).filter((melding) => !melding.tot);

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

            {data?.bijgewerktOp
              ? `Bijgewerkt ${data.bijgewerktOp}`
              : "Wordt geladen"}
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
        <div className="space-y-3 p-5">
          {(Object.keys(iconen) as Array<keyof typeof iconen>).map((key) => {
            const Icon = iconen[key];
            const item = data?.items?.[key];
            const status = item?.status || "onbekend";

            const inhoud = (
              <DashboardRij
                titel={item?.titel || titelFallback(key)}
                waarde={item?.waarde ?? null}
                subtitel={item?.subtitel || "Nog niet gekoppeld."}
                status={status}
                icon={Icon}
                isLoading={isLoading}
              />
            );

            return item?.href ? (
              <Link key={key} href={item.href} className="block">
                {inhoud}
              </Link>
            ) : (
              <div key={key}>{inhoud}</div>
            );
          })}

          <Link
            href="/admin/rapportage/medewerkers/ziekteverzuim"
            className="block"
          >
            <DashboardRij
              titel="Open ziekmeldingen"
              waarde={verzuimLoading ? null : openZiekmeldingen.length}
              status={
                openZiekmeldingen.length > 0
                  ? "waarschuwing"
                  : "goed"
              }
              icon={HeartPulse}
              isLoading={verzuimLoading}
              subtitel={
                verzuimError ? (
                  "Ziekmeldingen konden niet geladen worden."
                ) : verzuimLoading ? (
                  "Ziekmeldingen laden..."
                ) : openZiekmeldingen.length === 0 ? (
                  "Geen open ziekmeldingen."
                ) : (
                  <div className="space-y-1">
                    {openZiekmeldingen.slice(0, 4).map((melding) => (
                      <div key={melding.id}>
                        <span className="font-semibold text-slate-700">
                          {melding.medewerker_naam}
                        </span>{" "}
                        <span>Ziek sinds {datumNl(melding.van)}</span>
                      </div>
                    ))}

                    {openZiekmeldingen.length > 4 ? (
                      <div className="pt-1 font-medium text-slate-600">
                        + {openZiekmeldingen.length - 4} meer
                      </div>
                    ) : null}
                  </div>
                )
              }
            />
          </Link>
        </div>
      )}
    </section>
  );
}