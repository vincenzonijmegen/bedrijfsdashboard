"use client";

import React, { useEffect, useState } from "react";
import { DatabaseZap, Loader2, Play, RefreshCw } from "lucide-react";

export default function KassaOmzetImportPage() {
  const today = new Date().toISOString().substring(0, 10);
  const [startDate, setStartDate] = useState<string>(today);
  const [endDate, setEndDate] = useState<string>(today);
  const [status, setStatus] = useState<string>("");
  const [lastImport, setLastImport] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/rapportage/omzet/last-import")
      .then((res) => {
        if (!res.ok) throw new Error(`Status ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (data.lastImported) setLastImport(data.lastImported);
      })
      .catch((err) => {
        console.error("Fout bij ophalen lastImport:", err);
      });
  }, []);

  const handleImport = async () => {
    setLoading(true);
    setStatus("Importeren...");

    try {
      const res = await fetch(
        `/api/rapportage/omzet/import?start=${startDate}&einde=${endDate}`,
        { method: "POST" }
      );

      const ct = res.headers.get("content-type") || "";
      const body = await res.text();

      if (!res.ok) {
        setStatus(`❌ Fout bij import (HTTP ${res.status}): ${body.slice(0, 400)}`);
        return;
      }

      const json = ct.includes("application/json")
        ? JSON.parse(body)
        : { raw: body };

      const imported = json?.imported ?? 0;
      const upserts = json?.profiel_refresh?.upserts ?? 0;
      const range = json?.profiel_refresh?.range
        ? `${json.profiel_refresh.range.from}—${json.profiel_refresh.range.to}`
        : `${startDate}—${endDate}`;

      setStatus(
        `✅ Import OK • records: ${imported} • profiel upserts: ${upserts} • range: ${range}`
      );

      const r2 = await fetch("/api/rapportage/omzet/last-import");
      if (r2.ok) {
        const d2 = await r2.json();
        if (d2.lastImported) setLastImport(d2.lastImported);
      }
    } catch (err: any) {
      setStatus(`Fout bij import: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-600">
            <DatabaseZap className="h-4 w-4" />
            Rapportage / Omzetimport
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-950">
            Import omzet
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            Haal omzetgegevens uit de kassa op en werk rapportages bij.
          </p>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          {lastImport && (
            <div className="mb-5 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-800 ring-1 ring-blue-100">
              Laatst geïmporteerd op:{" "}
              <strong>{new Date(lastImport).toLocaleDateString("nl-NL")}</strong>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label>
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Startdatum
              </span>
              <input
                id="start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label>
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Einddatum
              </span>
              <input
                id="end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
            </label>
          </div>

          <button
            onClick={handleImport}
            disabled={loading}
            className="mt-5 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 md:w-auto"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importeren...
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Start import
              </>
            )}
          </button>

          {status && (
            <div
              className={`mt-5 rounded-xl px-4 py-3 text-sm whitespace-pre-wrap ring-1 ${
                status.startsWith("✅")
                  ? "bg-emerald-50 text-emerald-800 ring-emerald-100"
                  : status.startsWith("❌") || status.startsWith("Fout")
                  ? "bg-red-50 text-red-700 ring-red-100"
                  : "bg-slate-50 text-slate-700 ring-slate-200"
              }`}
            >
              <div className="flex items-start gap-2">
                <RefreshCw className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{status}</span>
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}