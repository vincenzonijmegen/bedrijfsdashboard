"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { ArrowLeft, BarChart3, Download, Search, TrendingUp } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const formatAantal = (value: unknown) =>
  Number(value || 0).toLocaleString("nl-NL", { maximumFractionDigits: 0 });

const maandNaam = (maand: number) =>
  new Date(2026, maand - 1, 1).toLocaleDateString("nl-NL", { month: "long" });

const vandaagIso = () => new Date().toISOString().slice(0, 10);

const seizoenStartIso = () => {
  const jaar = new Date().getFullYear();
  return `${jaar}-03-01`;
};

type PeriodePreset = "alles" | "dit_seizoen" | "dit_jaar" | "aangepast";

function buildCsv(rows: Record<string, any>[], jaren: number[]) {
  const headers = ["Product", ...jaren.map(String)];
  const regels = rows.map((row) =>
    [row.product, ...jaren.map((jaar) => row[`y${jaar}`] || 0)]
      .map((value) => `"${String(value).replaceAll('"', '""')}"`)
      .join(";")
  );
  return [headers.join(";"), ...regels].join("\n");
}

function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function ProductanalysePage() {
  const [periode, setPeriode] = useState<PeriodePreset>("alles");
  const [start, setStart] = useState(seizoenStartIso());
  const [end, setEnd] = useState(vandaagIso());
  const [product, setProduct] = useState("");
  const [verloopProduct, setVerloopProduct] = useState("");

  const query = useMemo(() => {
    const params = new URLSearchParams();

    if (periode === "dit_seizoen") {
      params.set("start", seizoenStartIso());
      params.set("end", vandaagIso());
    }

    if (periode === "dit_jaar") {
      const jaar = new Date().getFullYear();
      params.set("start", `${jaar}-01-01`);
      params.set("end", vandaagIso());
    }

    if (periode === "aangepast") {
      if (start) params.set("start", start);
      if (end) params.set("end", end);
    }

    if (product.trim()) params.set("product", product.trim());
    if (verloopProduct.trim()) params.set("verloopProduct", verloopProduct.trim());

    return params.toString();
  }, [periode, start, end, product, verloopProduct]);

  const { data, error, isLoading } = useSWR(
    `/api/rapportage/productanalyse?${query}`,
    fetcher
  );

  const jaren: number[] = data?.jaren || [];
  const seizoenJaren: number[] = data?.seizoenJaren || jaren;
  const aantallenPerJaarProduct: Record<string, any>[] =
    data?.aantallenPerJaarProduct || [];
  const seizoenVergelijking: Record<string, any>[] = data?.seizoenVergelijking || [];
  const topProducten = data?.topProducten || [];
  const groeiKrimp = data?.groeiKrimp || [];
  const verloop = data?.verloop;

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <Link
              href="/admin/rapportage"
              className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              <ArrowLeft className="h-4 w-4" /> Terug naar rapportages
            </Link>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
              <BarChart3 className="h-7 w-7 text-blue-600" /> Productanalyse
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Analyseer verkoopaantallen per product, jaar en seizoen op basis van rapportage.omzet.
            </p>
          </div>

          <button
            type="button"
            onClick={() =>
              downloadCsv(
                "productanalyse-aantallen-per-jaar.csv",
                buildCsv(aantallenPerJaarProduct, jaren)
              )
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            <Download className="h-4 w-4" /> Exporteer CSV
          </button>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <label className="space-y-1 text-sm font-medium text-slate-700">
              Periode
              <select
                value={periode}
                onChange={(e) => setPeriode(e.target.value as PeriodePreset)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="alles">Alle jaren</option>
                <option value="dit_seizoen">Dit seizoen tot vandaag</option>
                <option value="dit_jaar">Dit jaar tot vandaag</option>
                <option value="aangepast">Aangepaste periode</option>
              </select>
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              Startdatum
              <input
                type="date"
                value={start}
                disabled={periode !== "aangepast"}
                onChange={(e) => setStart(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400"
              />
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              Einddatum
              <input
                type="date"
                value={end}
                disabled={periode !== "aangepast"}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm disabled:bg-slate-100 disabled:text-slate-400"
              />
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              Productfilter
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={product}
                  onChange={(e) => setProduct(e.target.value)}
                  placeholder="Bijv. Beker, bol, slagroom"
                  className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm"
                />
              </div>
            </label>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            Productanalyse kon niet worden geladen.
          </div>
        )}

        {isLoading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            Rapportage wordt geladen...
          </div>
        )}

        {data?.success && (
          <>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-medium text-slate-500">Producten</div>
                <div className="mt-1 text-3xl font-bold text-slate-900">
                  {formatAantal(aantallenPerJaarProduct.length)}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-medium text-slate-500">Jaren in selectie</div>
                <div className="mt-1 text-3xl font-bold text-slate-900">
                  {jaren.length ? `${Math.min(...jaren)}-${Math.max(...jaren)}` : "-"}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="text-sm font-medium text-slate-500">Totaal aantallen</div>
                <div className="mt-1 text-3xl font-bold text-slate-900">
                  {formatAantal(
                    Object.values(data.jaarTotalen || {}).reduce(
                      (sum: number, value: any) => sum + Number(value || 0),
                      0
                    )
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-5">
                <h2 className="text-lg font-bold text-slate-900">
                  Aantallen per jaar per product
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Hoofdrapport met alle producten en verkoopaantallen per jaar.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="sticky left-0 bg-slate-50 px-4 py-3">Product</th>
                      {jaren.map((jaar) => (
                        <th key={jaar} className="px-4 py-3 text-right">
                          {jaar}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {aantallenPerJaarProduct.map((row) => (
                      <tr key={row.product} className="hover:bg-slate-50">
                        <td className="sticky left-0 bg-white px-4 py-2 font-medium text-slate-800">
                          {row.product}
                        </td>
                        {jaren.map((jaar) => (
                          <td key={jaar} className="px-4 py-2 text-right text-slate-700">
                            {formatAantal(row[`y${jaar}`])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 p-5">
                  <h2 className="text-lg font-bold text-slate-900">Topproducten</h2>
                  <p className="mt-1 text-sm text-slate-500">Top 50 binnen de gekozen selectie.</p>
                </div>
                <div className="max-h-[520px] overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">#</th>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3 text-right">Aantal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {topProducten.map((row: any, index: number) => (
                        <tr key={row.product} className="hover:bg-slate-50">
                          <td className="px-4 py-2 text-slate-500">{index + 1}</td>
                          <td className="px-4 py-2 font-medium text-slate-800">{row.product}</td>
                          <td className="px-4 py-2 text-right text-slate-700">
                            {formatAantal(row.aantal)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 p-5">
                  <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
                    <TrendingUp className="h-5 w-5 text-blue-600" /> Groei / krimp
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Vergelijking met vorig jaar of met dezelfde periode vorig jaar.
                  </p>
                </div>
                <div className="max-h-[520px] overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Product</th>
                        <th className="px-4 py-3 text-right">Nu</th>
                        <th className="px-4 py-3 text-right">Vorig jaar</th>
                        <th className="px-4 py-3 text-right">Verschil</th>
                        <th className="px-4 py-3 text-right">%</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {groeiKrimp.map((row: any) => (
                        <tr key={row.product} className="hover:bg-slate-50">
                          <td className="px-4 py-2 font-medium text-slate-800">{row.product}</td>
                          <td className="px-4 py-2 text-right">{formatAantal(row.aantalHuidig)}</td>
                          <td className="px-4 py-2 text-right">{formatAantal(row.aantalVorig)}</td>
                          <td
                            className={`px-4 py-2 text-right font-semibold ${
                              row.verschil >= 0 ? "text-emerald-700" : "text-red-700"
                            }`}
                          >
                            {row.verschil > 0 ? "+" : ""}
                            {formatAantal(row.verschil)}
                          </td>
                          <td
                            className={`px-4 py-2 text-right font-semibold ${
                              row.verschil >= 0 ? "text-emerald-700" : "text-red-700"
                            }`}
                          >
                            {row.percentage === null
                              ? "-"
                              : `${row.percentage > 0 ? "+" : ""}${row.percentage.toFixed(1)}%`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-5">
                <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Verloop in de tijd</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Maandverloop voor één gekozen product.
                    </p>
                  </div>
                  <label className="w-full space-y-1 text-sm font-medium text-slate-700 md:w-80">
                    Product
                    <input
                      value={verloopProduct}
                      onChange={(e) => setVerloopProduct(e.target.value)}
                      placeholder={verloop?.product || "Exacte productnaam"}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </label>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Jaar</th>
                      <th className="px-4 py-3">Maand</th>
                      <th className="px-4 py-3 text-right">Aantal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(verloop?.regels || []).map((row: any) => (
                      <tr key={`${row.jaar}-${row.maand}`} className="hover:bg-slate-50">
                        <td className="px-4 py-2 font-medium text-slate-800">{row.jaar}</td>
                        <td className="px-4 py-2 text-slate-700">{maandNaam(row.maand)}</td>
                        <td className="px-4 py-2 text-right text-slate-700">
                          {formatAantal(row.aantal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 p-5">
                <h2 className="text-lg font-bold text-slate-900">Seizoensvergelijking</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Vergelijkt elk jaar vanaf 1 maart tot dezelfde kalenderdag als vandaag.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="sticky left-0 bg-slate-50 px-4 py-3">Product</th>
                      {seizoenJaren.map((jaar) => (
                        <th key={jaar} className="px-4 py-3 text-right">
                          {jaar}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {seizoenVergelijking.map((row) => (
                      <tr key={row.product} className="hover:bg-slate-50">
                        <td className="sticky left-0 bg-white px-4 py-2 font-medium text-slate-800">
                          {row.product}
                        </td>
                        {seizoenJaren.map((jaar) => (
                          <td key={jaar} className="px-4 py-2 text-right text-slate-700">
                            {formatAantal(row[`y${jaar}`])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
