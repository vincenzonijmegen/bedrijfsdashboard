/* eslint-disable @typescript-eslint/no-unused-expressions */
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type Product = { id: string; naam: string }; // uit rapportage.omzet_dag_product (distinct namen)
type Selection = { label: string; productNames: string[] };

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  const j = await r.json();
  if (!r.ok) throw new Error(j?.error || "Error");
  return j;
}

export default function ProductVergelijkingPage() {
  const [dateFrom, setDateFrom] = useState("2022-01-01");
  const [dateTo, setDateTo] = useState("2025-12-31");

  // Opties komen uit omzet (niet uit bestel-artikelen)
  const [producten, setProducten] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Start met 2 selecties als voorbeeld
  const [selections, setSelections] = useState<Selection[]>([
    { label: "1 bol", productNames: [] },
    { label: "2 bollen", productNames: [] },
  ]);

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const canQuery =
    selections.length > 0 && selections.every((s) => s.productNames.length > 0);

  // Haal beschikbare productnamen uit de OMZET-tabel (distinct)
  useEffect(() => {
    (async () => {
      try {
        const data = await fetchJSON<Product[]>(
          `/api/rapportage/omzet-producten?dateFrom=${dateFrom}&dateTo=${dateTo}`
        );
        setProducten(data);
      } catch (e) {
        console.error(e);
        setProducten([]);
      } finally {
        setLoadingProducts(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // initieel laden; als je op datum wilt refetchen, zet dateFrom/dateTo in deps

  async function runQuery() {
    if (!canQuery) return;
    setLoading(true);
    try {
      const data = await fetchJSON<{ rows: any[]; selections: string[] }>(
        "/api/rapportage/product-verhoudingen",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dateFrom,
            dateTo,
            selections, // {label, productNames[]}
          }),
        }
      );
      setRows(data.rows);
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  // Alle paar-gewijze ratio’s (A/B, A/C, B/C, …)
  const ratioPairs = useMemo(() => {
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < selections.length; i++) {
      for (let j = i + 1; j < selections.length; j++) {
        pairs.push([i, j]);
      }
    }
    return pairs;
  }, [selections]);

  const hasRows = Array.isArray(rows) && rows.length > 0;

  // Resultaat sectie vooraf opbouwen (geen conditionele expressies in JSX)
  let resultSection: ReactNode = null;
  if (hasRows) {
    resultSection = (
      <div className="overflow-auto">
        <table className="min-w-[760px] border-collapse">
          <thead>
            <tr>
              <th className="border p-2 text-left">Jaar</th>
              {selections.map((s, i) => (
                <th key={i} className="border p-2 text-right">
                  {s.label}
                </th>
              ))}
              {ratioPairs.map(([a, b], i) => (
                <th key={`r${i}`} className="border p-2 text-right">
                  {selections[a].label} ÷ {selections[b].label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const jaar = r.jaar;
              const values = selections.map((s) => Number(r[s.label] ?? 0));
              const ratios = ratioPairs.map(([a, b]) => {
                const denom = values[b] || 0;
                return denom === 0 ? null : values[a] / denom;
              });
              return (
                <tr key={idx}>
                  <td className="border p-2">{jaar}</td>
                  {values.map((v, i) => (
                    <td key={i} className="border p-2 text-right">
                      {v.toLocaleString()}
                    </td>
                  ))}
                  {ratios.map((rv, i) => (
                    <td key={i} className="border p-2 text-right">
                      {rv == null ? "—" : rv.toFixed(2)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Productvergelijking (per jaar)</h1>

      {/* Filters */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="block text-sm font-medium">Van</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border rounded p-2 w-full"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium">Tot en met</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border rounded p-2 w-full"
          />
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-medium">Selecties</label>
          <button
            className="border rounded px-3 py-2 w-full"
            onClick={() =>
              setSelections((s) => [
                ...s,
                { label: `Selectie ${s.length + 1}`, productNames: [] },
              ])
            }
          >
            + selectie toevoegen
          </button>
        </div>
      </div>

      {/* Selectieblokken */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {selections.map((sel, idx) => (
          <div key={idx} className="border rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <input
                className="border rounded p-2 flex-1"
                value={sel.label}
                onChange={(e) => {
                  const v = e.target.value;
                  setSelections((s) =>
                    s.map((x, i) => (i === idx ? { ...x, label: v } : x))
                  );
                }}
              />
              <button
                className="text-red-600"
                onClick={() =>
                  setSelections((s) => s.filter((_, i) => i !== idx))
                }
                title="Verwijderen"
              >
                ✕
              </button>
            </div>

            <div className="space-y-2">
              <label className="text-sm">Kies productnamen (uit omzet)</label>
              <div className="h-44 overflow-auto border rounded p-2 space-y-1">
                {loadingProducts ? (
                  <div className="text-sm text-gray-500">Producten laden…</div>
                ) : (
                  producten.map((p) => {
                    const checked = sel.productNames.includes(p.naam);
                    return (
                      <label key={p.id} className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelections((s) =>
                              s.map((x, i) => {
                                if (i !== idx) return x;
                                const set = new Set(x.productNames);
                                checked ? set.delete(p.naam) : set.add(p.naam);
                                return { ...x, productNames: Array.from(set) };
                              })
                            );
                          }}
                        />
                        <span>{p.naam}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3">
        <button
          className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
          disabled={!canQuery || loading}
          onClick={runQuery}
        >
          {loading ? "Bezig..." : "Bereken"}
        </button>
      </div>

      {/* Resultaat */}
      {resultSection}
    </div>
  );
}
