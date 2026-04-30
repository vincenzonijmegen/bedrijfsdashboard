"use client";

import React, { useEffect, useRef, useState } from "react";
import useSWR from "swr";
import { useSnackbar } from "@/lib/useSnackbar";
import {
  Package,
  Loader2,
  Mail,
  RotateCcw,
  Plus,
  Minus,
  ShoppingCart,
} from "lucide-react";

interface Leverancier {
  id: number;
  naam: string;
  soort: string;
}

interface Product {
  id: number;
  naam: string;
  bestelnummer?: string;
  besteleenheid?: number;
  huidige_prijs?: number;
  volgorde?: number;
}

type Invoer = Record<number, number>;

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error("Fout bij ophalen");
    return r.json();
  });

const deepEqual = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);

export default function BestelPagina() {
  const [leverancierId, setLeverancierId] = useState<number | null>(null);
  const [invoer, setInvoer] = useState<Invoer>({});
  const [referentieSuffix, setReferentieSuffix] = useState("");
  const [opmerking, setOpmerking] = useState("");
  const [toonIncidenteel, setToonIncidenteel] = useState(false);
  const [loadedLeverancierId, setLoadedLeverancierId] = useState<number | null>(
    null
  );

  const suppressUntilRef = useRef<number>(0);
  const lastLocalChangeAtRef = useRef<number>(0);
  const shownOnceRef = useRef<Record<number, boolean>>({});
  const { showSnackbar } = useSnackbar();

  const datumPrefix = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const referentie = `${datumPrefix}-${referentieSuffix}`;

  const { data: leveranciers } = useSWR<Leverancier[]>(
    "/api/leveranciers",
    fetcher
  );

  const { data: producten } = useSWR<Product[]>(
    leverancierId ? `/api/producten?leverancier=${leverancierId}` : null,
    fetcher
  );

  const { data: historie } = useSWR<any[]>(
    leverancierId
      ? `/api/bestelling/historie?leverancier=${leverancierId}`
      : null,
    fetcher
  );

  const { data: onderhanden } = useSWR(
    leverancierId
      ? `/api/bestelling/onderhanden?leverancier=${leverancierId}`
      : null,
    fetcher,
    {
      revalidateOnFocus: true,
      dedupingInterval: 5000,
      focusThrottleInterval: 10000,
    }
  );

  const geselecteerdeLeverancier = leveranciers?.find(
    (l) => l.id === leverancierId
  );

  const gesorteerdeProducten = [...(producten ?? [])].sort(
    (a, b) => (a.volgorde ?? 999) - (b.volgorde ?? 999)
  );

  const totaal = gesorteerdeProducten.reduce(
    (s, p) => s + (invoer[p.id] ?? 0) * (p.huidige_prijs ?? 0),
    0
  );

  const aantalRegels = Object.values(invoer).filter((n) => Number(n) > 0).length;

  const onSelectLeverancier: React.ChangeEventHandler<HTMLSelectElement> = (
    e
  ) => {
    const id = Number(e.target.value);
    if (Number.isNaN(id)) return;

    setLeverancierId(id);
    setInvoer({});
    setLoadedLeverancierId(null);
    shownOnceRef.current[id] = false;
  };

  useEffect(() => {
    if (!leverancierId) return;
    if (onderhanden === undefined) return;

    const serverData: Invoer = (onderhanden?.data as Invoer) ?? {};
    if (!deepEqual(invoer, serverData)) setInvoer(serverData);

    const justEditedLocally = Date.now() - lastLocalChangeAtRef.current < 1200;

    if (!shownOnceRef.current[leverancierId] && !justEditedLocally) {
      showSnackbar("Opgeslagen bestelling geladen");
      shownOnceRef.current[leverancierId] = true;
    }

    setLoadedLeverancierId(leverancierId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onderhanden, leverancierId]);

  useEffect(() => {
    if (leverancierId == null) return;
    if (loadedLeverancierId !== leverancierId) return;
    if (Date.now() < suppressUntilRef.current) return;

    const hasItems = Object.values(invoer).some((n) => Number(n) > 0);
    if (!hasItems) return;

    fetch("/api/bestelling/onderhanden", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leverancier_id: leverancierId, data: invoer, referentie }),
    }).catch(() => {});
  }, [invoer, leverancierId, referentie, loadedLeverancierId]);

  const wijzigAantal = (id: number, delta: number) => {
    lastLocalChangeAtRef.current = Date.now();
    setInvoer((prev) => ({
      ...prev,
      [id]: Math.max(0, (prev[id] ?? 0) + delta),
    }));
  };

  const setAantal = (id: number, value: number) => {
    lastLocalChangeAtRef.current = Date.now();
    setInvoer((prev) => ({ ...prev, [id]: Math.max(0, value) }));
  };

  const genereerTekst = () => {
    const naam = geselecteerdeLeverancier?.naam ?? "Onbekend";
    const rows: { bestelnummer: string; naam: string; aantal: number }[] = [];

    producten?.forEach((p) => {
      const n = invoer[p.id] ?? 0;
      if (n > 0) {
        rows.push({
          bestelnummer: p.bestelnummer ?? String(p.id),
          naam: p.naam,
          aantal: n,
        });
      }
    });

    let tekst = `Bestelling IJssalon Vincenzo – ${naam}
Referentie: ${referentie}

`;

    tekst += `Aantal\tBestelnummer\tProduct
`;
    tekst += `------\t------------\t-------
`;

    rows.forEach((r) => {
      tekst += `${r.aantal}\t${r.bestelnummer}\t${r.naam}
`;
    });

    if (opmerking.trim()) {
      tekst += `

Opmerkingen: ${opmerking.trim()}`;
    }

    return tekst;
  };

  const resetBestelling = async () => {
    if (!leverancierId) return;

    await fetch(`/api/bestelling/onderhanden?leverancier=${leverancierId}`, {
      method: "DELETE",
    });

    suppressUntilRef.current = Date.now() + 1500;
    setLoadedLeverancierId(null);
    setInvoer({});
    showSnackbar("Bestelling is gereset");
  };

  const mailBestelling = async () => {
    if (!leverancierId) return;

    const naar = prompt(
      "Naar welk e-mailadres?",
      "bestelling@ijssalonvincenzo.nl"
    );
    if (!naar) return;

    await fetch("/api/mail/bestelling", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        naar,
        onderwerp: `Bestelling IJssalon Vincenzo – ${
          geselecteerdeLeverancier?.naam ?? "Onbekend"
        } – ${referentie}`,
        tekst: genereerTekst(),
      }),
    });

    const response = await fetch(`/api/bestelling/historie`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leverancier_id: leverancierId,
        data: invoer,
        referentie,
        opmerking,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      alert("❌ Historie NIET opgeslagen:\n" + JSON.stringify(result));
      return;
    }

    await resetBestelling();
    alert("Bestelling is verzonden!");
  };

  if (!leveranciers) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Bestelpagina laden…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-4 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:mb-6 sm:px-6 sm:py-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-600">
                <Package className="h-4 w-4" />
                Voorraad / Bestellen
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Bestellen
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Maak een bestelling per leverancier. Invoer wordt automatisch
                tussentijds opgeslagen.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
              <div className="rounded-xl bg-blue-50 px-4 py-3 ring-1 ring-blue-100">
                <div className="text-xs font-medium uppercase tracking-wide text-blue-600">
                  Regels
                </div>
                <div className="text-2xl font-bold text-blue-950">
                  {aantalRegels}
                </div>
              </div>

              <div className="rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
                <div className="text-xs font-medium uppercase tracking-wide text-emerald-600">
                  Totaal
                </div>
                <div className="text-2xl font-bold text-emerald-950">
                  €{totaal.toFixed(2)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:mb-6 sm:p-5">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto] md:items-end">
            <label>
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Leverancier
              </span>
              <select
                className="h-12 w-full rounded-xl border border-slate-200 bg-white px-3 text-base outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100 sm:text-sm"
                value={leverancierId ?? ""}
                onChange={onSelectLeverancier}
              >
                <option value="">-- Kies leverancier --</option>
                {leveranciers
                  .filter((l) =>
                    toonIncidenteel
                      ? l.soort === "incidenteel"
                      : l.soort === "wekelijks"
                  )
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.naam}
                    </option>
                  ))}
              </select>
            </label>

            <label className="flex h-12 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700">
              <input
                type="checkbox"
                checked={toonIncidenteel}
                onChange={(e) => setToonIncidenteel(e.target.checked)}
                className="h-4 w-4 accent-blue-600"
              />
              Toon incidentele leveranciers
            </label>
          </div>
        </section>

        {leverancierId && (
          <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:mb-6 sm:p-5">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[240px_1fr_auto_auto] md:items-end">
              <label>
                <span className="mb-1 block text-sm font-semibold text-slate-700">
                  Referentie
                </span>
                <input
                  type="text"
                  value={referentieSuffix}
                  onChange={(e) => setReferentieSuffix(e.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100 sm:text-sm"
                  placeholder="bijv. vrijdag"
                />
              </label>

              <label>
                <span className="mb-1 block text-sm font-semibold text-slate-700">
                  Opmerking
                </span>
                <input
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100 sm:text-sm"
                  placeholder="Optioneel"
                  value={opmerking}
                  onChange={(e) => setOpmerking(e.target.value)}
                />
              </label>

              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                onClick={mailBestelling}
              >
                <Mail size={16} />
                Mail
              </button>

              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                onClick={resetBestelling}
              >
                <RotateCcw size={16} />
                Reset
              </button>
            </div>
          </section>
        )}

        {leverancierId && (
          <>
            <section className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                    <ShoppingCart size={20} />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-950">
                      {geselecteerdeLeverancier?.naam ?? "Bestelling"}
                    </h2>
                    <p className="text-sm text-slate-500">
                      Gebruik plus/min of vul aantallen direct in.
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="border-b border-slate-200 px-4 py-3 text-left">
                        Product
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left">
                        Eenheid
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left">
                        Prijs
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left">
                        Aantal
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left">
                        Actie
                      </th>
                      {(historie ?? []).slice(0, 6).map((b, i) => (
                        <th
                          key={i}
                          className="border-b border-slate-200 px-3 py-3 text-center font-semibold"
                          title={`Besteld op ${new Date(
                            b.besteld_op
                          ).toLocaleDateString("nl-NL")}`}
                        >
                          {i + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {gesorteerdeProducten.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-950">
                          {p.naam}
                          {p.bestelnummer && (
                            <div className="text-xs font-normal text-slate-500">
                              {p.bestelnummer}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-3 text-slate-700">
                          {p.besteleenheid ?? 1}
                        </td>

                        <td className="px-4 py-3 font-medium text-slate-900">
                          {p.huidige_prijs != null
                            ? `€ ${Number(p.huidige_prijs).toFixed(2)}`
                            : "–"}
                        </td>

                        <td className="px-4 py-3">
                          <input
                            type="number"
                            min="0"
                            className="h-10 w-20 rounded-xl border border-slate-200 px-2 text-right outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                            value={invoer[p.id] ?? 0}
                            onChange={(e) =>
                              setAantal(
                                p.id,
                                isNaN(Number(e.target.value))
                                  ? 0
                                  : Number(e.target.value)
                              )
                            }
                          />
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => wijzigAantal(p.id, -1)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                            >
                              <Minus size={16} />
                            </button>

                            <button
                              onClick={() => wijzigAantal(p.id, 1)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white hover:bg-blue-700"
                            >
                              <Plus size={16} />
                            </button>
                          </div>
                        </td>

                        {(historie ?? []).slice(0, 6).map((b, i) => (
                          <td
                            key={i}
                            className="px-3 py-3 text-center font-bold text-slate-700"
                          >
                            {b.data?.[p.id] ?? "–"}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="space-y-3 md:hidden">
              {gesorteerdeProducten.map((p) => {
                const aantal = invoer[p.id] ?? 0;

                return (
                  <div
                    key={p.id}
                    className={`rounded-2xl border bg-white p-4 shadow-sm ${
                      aantal > 0 ? "border-blue-200 ring-1 ring-blue-100" : "border-slate-200"
                    }`}
                  >
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-bold leading-tight text-slate-950">
                          {p.naam}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Eenheid {p.besteleenheid ?? 1}
                          {p.huidige_prijs != null &&
                            ` · € ${Number(p.huidige_prijs).toFixed(2)}`}
                        </div>
                      </div>

                      {aantal > 0 && (
                        <div className="rounded-full bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700 ring-1 ring-blue-100">
                          {aantal}
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-[48px_1fr_48px] items-center gap-2">
                      <button
                        onClick={() => wijzigAantal(p.id, -1)}
                        className="flex h-12 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-700 active:bg-slate-200"
                      >
                        <Minus size={18} />
                      </button>

                      <input
                        type="number"
                        min="0"
                        className="h-12 w-full rounded-xl border border-slate-200 px-3 text-center text-lg font-bold outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                        value={aantal}
                        onChange={(e) =>
                          setAantal(
                            p.id,
                            isNaN(Number(e.target.value))
                              ? 0
                              : Number(e.target.value)
                          )
                        }
                      />

                      <button
                        onClick={() => wijzigAantal(p.id, 1)}
                        className="flex h-12 items-center justify-center rounded-xl bg-blue-600 text-white active:bg-blue-700"
                      >
                        <Plus size={18} />
                      </button>
                    </div>
                  </div>
                );
              })}

              <div className="sticky bottom-3 z-20 rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-xl backdrop-blur">
                <div className="mb-3 flex items-center justify-between text-sm">
                  <span className="font-semibold text-slate-600">Totaal</span>
                  <span className="text-xl font-bold text-slate-950">
                    €{totaal.toFixed(2)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 text-sm font-semibold text-red-700"
                    onClick={resetBestelling}
                  >
                    <RotateCcw size={15} />
                    Reset
                  </button>

                  <button
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 text-sm font-semibold text-white"
                    onClick={mailBestelling}
                  >
                    <Mail size={15} />
                    Mail
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}