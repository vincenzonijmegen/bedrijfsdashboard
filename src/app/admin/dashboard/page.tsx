"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  CreditCard,
  Gift,
  Loader2,
  RefreshCw,
  Wallet,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const euro = (value: number) =>
  `€ ${value.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`;

export default function DashboardPage() {
  const [singleDate, setSingleDate] = useState(() => {
    const today = new Date();
    return today.toISOString().substring(0, 10);
  });

  const formatDMY = (iso: string) => {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  const {
    data: totalen,
    error: errorTotal,
    mutate: mutateTotal,
    isLoading,
  } = useSWR(`/api/kassa/omzet?start=${formatDMY(singleDate)}&totalen=1`, fetcher);

  const record = Array.isArray(totalen)
    ? (totalen[0] as Record<string, string>)
    : null;

  const cash = record ? parseFloat(record.Cash) || 0 : 0;
  const pin = record ? parseFloat(record.Pin) || 0 : 0;
  const bon = record ? parseFloat(record.Bon) || 0 : 0;
  const isvoucher = record ? parseFloat(record.isvoucher) || 0 : 0;
  const total = cash + pin + bon;

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-600">
                <BarChart3 className="h-4 w-4" />
                Dashboard / Dagomzet
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Dagomzet
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Bekijk de omzetverdeling per betaalmethode voor één dag.
              </p>
            </div>

            <Link
              href="/admin"
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <ArrowLeft size={16} />
              Management portaal
            </Link>
          </div>
        </div>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-[1fr_auto] md:items-end">
            <label>
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Datum
              </span>
              <input
                id="singleDate"
                type="date"
                value={singleDate}
                onChange={(e) => setSingleDate(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <button
              onClick={() => mutateTotal()}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <RefreshCw size={16} />
              Ververs
            </button>
          </div>
        </section>

        {errorTotal && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 shadow-sm">
            Fout bij laden dagomzet: {errorTotal.message}
          </div>
        )}

        {isLoading && !errorTotal && (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
            <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />
            <p className="text-sm text-slate-500">Dagomzet laden…</p>
          </div>
        )}

        {record && (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <h2 className="text-lg font-bold text-slate-950">
                Omzetoverzicht
              </h2>
              <p className="text-sm text-slate-500">
                Datum: {new Date(singleDate).toLocaleDateString("nl-NL")}
              </p>
            </div>

            <div className="grid gap-3 p-5 md:grid-cols-3">
              <OmzetCard icon={Wallet} label="Contant" value={cash} />
              <OmzetCard icon={CreditCard} label="Pin" value={pin} />
              <OmzetCard icon={Gift} label="Cadeaubon" value={bon} />
            </div>

            <div className="border-t border-slate-200 bg-blue-50 px-5 py-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-blue-600">
                    Totaal
                  </div>
                  <div className="text-sm text-blue-800">
                    Contant + pin + cadeaubon
                  </div>
                </div>

                <div className="text-3xl font-bold tabular-nums text-blue-950">
                  {euro(total)}
                </div>
              </div>
            </div>

            <div className="px-5 py-4">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3 text-sm ring-1 ring-slate-200">
                <span className="font-semibold text-slate-700">
                  Bonnen verkocht
                </span>
                <span className="font-bold tabular-nums text-slate-950">
                  {euro(isvoucher)}
                </span>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

function OmzetCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.FC<React.SVGProps<SVGSVGElement>>;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-4 ring-1 ring-slate-200">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
        <Icon className="h-5 w-5" />
      </div>

      <div className="text-sm font-semibold text-slate-600">{label}</div>
      <div className="mt-1 text-2xl font-bold tabular-nums text-slate-950">
        {euro(value)}
      </div>
    </div>
  );
}