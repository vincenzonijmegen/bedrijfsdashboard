"use client";

import { useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  Line,
  LineChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Onderdeel = {
  id: number;
  code: "winst_en_verlies" | "balans_activa" | "balans_passiva";
  naam: string;
};

type Rubriek = {
  id: number;
  onderdeel_id: number;
  naam: string;
};

type Regel = {
  id: number;
  rubriek_id: number;
  naam: string;
  is_totaal: boolean;
  bedragen: Record<string, string | number | null>;
};

function bedrag(regel: Regel, jaar: number) {
  const value = regel.bedragen?.[jaar];
  if (value === null || value === undefined || value === "") return 0;
  return Number(value);
}

function formatEuro(value: number) {
  return new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPercentage(value: number) {
  return `${value.toFixed(1)}%`;
}

export default function JaarrekeningGrafiekenPage() {
  const { data, error } = useSWR("/api/admin/jaarrekeningen", fetcher);

  const onderdelen: Onderdeel[] = data?.onderdelen || [];
  const rubrieken: Rubriek[] = data?.rubrieken || [];
  const regels: Regel[] = data?.regels || [];
  const jaren: number[] = data?.jaren || [];

  const grafiekData = useMemo(() => {
    const onderdeelWV = onderdelen.find((o) => o.code === "winst_en_verlies");
    if (!onderdeelWV) return [];

    const wvRubrieken = rubrieken.filter(
      (r) => r.onderdeel_id === onderdeelWV.id
    );

    const omzetRubriek = wvRubrieken.find(
      (r) => r.naam.trim().toLowerCase() === "omzet excl. btw"
    );

    function regelsVanRubriek(rubriekId: number) {
      return regels.filter((r) => r.rubriek_id === rubriekId && !r.is_totaal);
    }

    function rubriekTotaal(rubriekId: number, jaar: number) {
      return regelsVanRubriek(rubriekId).reduce(
        (som, r) => som + bedrag(r, jaar),
        0
      );
    }

    return jaren.map((jaar) => {
      const omzet = omzetRubriek ? rubriekTotaal(omzetRubriek.id, jaar) : 0;

      const kosten = wvRubrieken
        .filter((r) => r.id !== omzetRubriek?.id)
        .reduce((som, r) => som + rubriekTotaal(r.id, jaar), 0);

      const winst = omzet - kosten;
      const winstmarge = omzet ? (winst / omzet) * 100 : 0;

      return {
        jaar,
        omzet,
        kosten,
        winst,
        winstmarge,
      };
    });
  }, [onderdelen, rubrieken, regels, jaren]);

  if (error) return <div className="p-6 text-red-600">Fout bij laden.</div>;
  if (!data) return <div className="p-6">Laden...</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Link
            href="/admin/rapportage/financieel"
            className="text-sm text-blue-700 hover:underline"
          >
            ← Terug naar financiële rapportages
          </Link>

          <div className="mt-3">
            <h1 className="text-2xl font-bold text-slate-900">
              Grafieken jaarrekeningen
            </h1>
            <p className="text-sm text-slate-500">
              Ontwikkeling van omzet, kosten, winst en winstmarge per jaar.
            </p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Kpi
            titel="Laatste omzet"
            waarde={formatEuro(grafiekData.at(-1)?.omzet || 0)}
          />
          <Kpi
            titel="Laatste kosten"
            waarde={formatEuro(grafiekData.at(-1)?.kosten || 0)}
          />
          <Kpi
            titel="Laatste winst"
            waarde={formatEuro(grafiekData.at(-1)?.winst || 0)}
          />
          <Kpi
            titel="Laatste winstmarge"
            waarde={formatPercentage(grafiekData.at(-1)?.winstmarge || 0)}
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">
            Omzet, kosten en winst
          </h2>

          <div className="h-[420px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={grafiekData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="jaar" />
                <YAxis tickFormatter={(value) => `${Math.round(value / 1000)}k`} />
                <Tooltip
                  formatter={(value) => formatEuro(Number(value))}
                  labelFormatter={(label) => `Jaar ${label}`}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="omzet"
                  name="Omzet"
                  stroke="#2563eb"
                  strokeWidth={3}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="kosten"
                  name="Kosten"
                  stroke="#f97316"
                  strokeWidth={3}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="winst"
                  name="Winst"
                  stroke="#16a34a"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">
            Winstmarge
          </h2>

          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={grafiekData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="jaar" />
                <YAxis tickFormatter={(value) => `${value}%`} />
                <Tooltip
                  formatter={(value) => formatPercentage(Number(value))}
                  labelFormatter={(label) => `Jaar ${label}`}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="winstmarge"
                  name="Winstmarge"
                  stroke="#7c3aed"
                  strokeWidth={3}
                  dot
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}

function Kpi({ titel, waarde }: { titel: string; waarde: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{titel}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{waarde}</p>
    </div>
  );
}