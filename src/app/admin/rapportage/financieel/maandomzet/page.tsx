// ===========================
// File: src/app/admin/rapportage/maandomzet/page.tsx
// ===========================
"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then(async (r) => {
  if (!r.ok) {
    const err = await r.json().catch(() => ({}));
    throw new Error(err?.details || err?.error || `HTTP ${r.status}`);
  }
  return r.json();
});

type MaandRow = { maand: number; omzet: number; dagen: number };
type ApiResp = { jaar: number; maanden: MaandRow[] };

const maandNamen = [
  "", // 0 filler
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];

export default function MaandomzetPagina() {
  const [jaar, setJaar] = useState<number>(new Date().getFullYear());
  const { data, error, isLoading, mutate } = useSWR<ApiResp>(
    `/api/rapportage/maandomzet?jaar=${jaar}`,
    fetcher,
    { revalidateOnFocus: false }
  );

  const { maanden, totaal } = useMemo(() => {
    const m = data?.maanden ?? [];
    const t = m.reduce((s, r) => s + (r.omzet || 0), 0);
    return { maanden: m, totaal: t };
  }, [data]);

  const allZero = useMemo(
    () => (maanden?.length ?? 0) > 0 && maanden.every((r) => (r.omzet || 0) === 0),
    [maanden]
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <a href="/admin/rapportage" className="text-sm text-blue-600 hover:underline">
          ← Financiële Rapportages
        </a>
      </div>

      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Maandomzet per jaar</h1>
          <p className="text-slate-500">
            Overzicht van geregistreerde omzet per maand. Gegevens voor <span className="font-medium">{jaar}</span>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="jaar" className="text-sm text-slate-600">Jaar</label>
          <input
            id="jaar"
            type="number"
            className="border rounded-md px-3 py-2 w-32"
            value={jaar}
            onChange={(e) => setJaar(parseInt(e.target.value || `${new Date().getFullYear()}`, 10))}
            onBlur={() => mutate()}
          />
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="rounded-md border p-4 text-slate-600">
          Gegevens laden…
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-4 text-red-700">
          Kon de gegevens niet laden: <span className="font-mono">{error.message}</span>
        </div>
      )}

      {/* Content */}
      {!isLoading && !error && (
        <>
          {/* Hint i.p.v. “geen gegevens” */}
          {allZero && (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-800">
              Gegevens geladen voor {jaar}. Alle maanden hebben momenteel een omzet van 0.
              Controleer zo nodig je import of gekozen jaar.
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Maand</th>
                  <th className="px-4 py-3 text-right font-semibold">Omzet</th>
                  <th className="px-4 py-3 text-right font-semibold">Dagen</th>
                </tr>
              </thead>
              <tbody>
                {maanden?.map((r) => (
                  <tr key={r.maand} className="border-t">
                    <td className="px-4 py-2">{maandNamen[r.maand]}</td>
                    <td className="px-4 py-2 text-right">€ {formatMoney(r.omzet)}</td>
                    <td className="px-4 py-2 text-right">{r.dagen}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t">
                <tr>
                  <td className="px-4 py-3 font-semibold">Totaal</td>
                  <td className="px-4 py-3 text-right font-semibold">€ {formatMoney(totaal)}</td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function formatMoney(n: number | undefined) {
  const v = Number(n || 0);
  return v.toLocaleString("nl-NL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}
