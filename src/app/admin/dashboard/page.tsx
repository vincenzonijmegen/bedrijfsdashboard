// src/app/admin/dashboard/page.tsx

"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const euro = (value: number) =>
  `€ ${value.toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

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
  } = useSWR(`/api/kassa/omzet?start=${formatDMY(singleDate)}&totalen=1`, fetcher);

  const record = Array.isArray(totalen)
    ? (totalen[0] as Record<string, string>)
    : null;

  const cash = record ? parseFloat(record.Cash) || 0 : 0;
  const pin = record ? parseFloat(record.Pin) || 0 : 0;
  const bon = record ? parseFloat(record.Bon) || 0 : 0;
  const isvoucher = record ? parseFloat(record.isvoucher) || 0 : 0;
  const total = cash + pin + bon;
  const omzetLaag = record ? parseFloat(String(record.omzetLaag)) || 0 : 0;
  const omzetHoog = record ? parseFloat(String(record.omzetHoog)) || 0 : 0;
  const verkoopCadeaubonnen = record
    ? parseFloat(String(record.verkoopCadeaubonnen)) || 0
    : 0;
  const onbekendeProducten = record && Array.isArray(record.onbekendeProducten)
    ? record.onbekendeProducten
    : [];

  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-6">
      <div className="w-full max-w-md">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <div className="text-sm font-medium text-blue-600">
              Dashboard / Dagomzet
            </div>
            <h1 className="text-xl font-bold text-slate-950">Dagomzet</h1>
          </div>

          {errorTotal && (
            <p className="mb-4 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-red-100">
              Error: {errorTotal.message}
            </p>
          )}

          {!totalen && !errorTotal && (
            <p className="mb-4 text-sm text-slate-500">Laden...</p>
          )}

          {record && (
            <div className="mb-5 space-y-2 text-sm">
              <Row label="Contant" value={euro(cash)} />
              <Row label="Pin" value={euro(pin)} />
              <Row label="Cadeaubon" value={euro(bon)} />

              <div className="my-3 border-t border-slate-200" />

              <div className="flex justify-between text-lg font-bold text-slate-950">
                <span>TOTAAL</span>
                <span>{euro(total)}</span>
              </div>

              <div className="flex justify-between text-sm text-slate-500">
                <span>Bonnen verkocht</span>
                <span>{euro(isvoucher)}</span>
              </div>

              <div className="my-3 border-t border-slate-200" />

              <div className="rounded-xl bg-slate-50 p-3 ring-1 ring-slate-200">
                <div className="mb-2 text-sm font-bold text-slate-950">
                  Overnemen in kasboek
                </div>

                <div className="space-y-1 text-sm">
                  <Row label="Verkopen laag 9%" value={euro(omzetLaag)} />
                  <Row label="Verkopen hoog 21%" value={euro(omzetHoog)} />
                  <Row label="Verkoop cadeaubonnen" value={euro(verkoopCadeaubonnen)} />
                  <Row label="Ingenomen cadeaubon" value={euro(bon)} />
                </div>
              </div>

              {onbekendeProducten.length > 0 && (
                <div className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-900 ring-1 ring-amber-200">
                  <div className="font-bold">Onbekende producten</div>
                  <ul className="mt-1 list-disc pl-4">
                    {onbekendeProducten.map((product: string) => (
                      <li key={product}>{product}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-[1fr_auto] gap-2">
            <input
              id="singleDate"
              type="date"
              value={singleDate}
              onChange={(e) => setSingleDate(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            />

            <button
              onClick={() => mutateTotal()}
              className="h-10 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Ververs
            </button>
          </div>
        </section>

        <Link
          href="/admin"
          className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          Ga naar Management Portaal
        </Link>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-slate-700">
      <span>{label}</span>
      <span className="font-semibold tabular-nums text-slate-950">{value}</span>
    </div>
  );
}