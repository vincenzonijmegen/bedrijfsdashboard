"use client";

import { useState } from "react";
import useSWR, { mutate } from "swr";
import ScrollToTopButton from "@/components/ScrollToTopButton";
import {
  BookOpenText,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

interface Product {
  id: number;
  naam: string;
  eenheid: string;
  inhoud?: number;
  huidige_prijs?: number;
  is_samengesteld?: boolean;
}

interface ReceptRegel {
  product_id: number;
  hoeveelheid: number;
  eenheid: string;
  product_naam?: string;
}

interface Recept {
  id?: number;
  naam: string;
  omschrijving?: string;
  totaal_output?: number;
  eenheid?: string;
  product_id?: number;
  regels: ReceptRegel[];
}

function converteerEenheid(qty: number, van: string, naar: string): number {
  const factor: Record<string, number> = {
    g: 1,
    kg: 1000,
    ml: 1,
    l: 1000,
  };

  if (factor[van] && factor[naar]) {
    return qty * (factor[van] / factor[naar]);
  }

  return qty;
}

export default function ReceptenBeheer() {
  const [recept, setRecept] = useState<Recept>({ naam: "", regels: [] });
  const [openReceptId, setOpenReceptId] = useState<number | null>(null);

  const { data: producten, error: productenError } = useSWR<Product[]>(
    "/api/producten",
    fetcher
  );
  const { data: recepten, error: receptenError } = useSWR<Recept[]>(
    "/api/recepten",
    fetcher
  );

  const categorieen = ["mixen", "vruchtensmaken", "melksmaken", "overig"];

  function wijzigRegel(index: number, veld: keyof ReceptRegel, waarde: any) {
    const nieuw = [...recept.regels];
    nieuw[index] = { ...nieuw[index], [veld]: waarde };
    setRecept({ ...recept, regels: nieuw });
  }

  function berekenRegelKostprijs(regel: ReceptRegel): number {
    const prod = producten?.find((p) => p.id === regel.product_id);
    if (!prod) return 0;

    if (prod.is_samengesteld) {
      const sub = recepten?.find((r) => r.product_id === prod.id);
      if (!sub || !sub.totaal_output) return 0;

      const subTotaal = sub.regels.reduce((sum, sr) => {
        const p = producten?.find((pp) => pp.id === sr.product_id);
        if (!p || !p.inhoud || !p.huidige_prijs) return sum;

        const qty = converteerEenheid(sr.hoeveelheid, sr.eenheid, p.eenheid);
        return sum + (p.huidige_prijs / p.inhoud) * qty;
      }, 0);

      const prijsPerEenheid = subTotaal / sub.totaal_output;
      const qtyBasis = converteerEenheid(
        regel.hoeveelheid,
        regel.eenheid,
        sub.eenheid || "l"
      );

      return prijsPerEenheid * qtyBasis;
    }

    if (!prod.inhoud || !prod.huidige_prijs) return 0;

    const qty = converteerEenheid(regel.hoeveelheid, regel.eenheid, prod.eenheid);
    return (prod.huidige_prijs / prod.inhoud) * qty;
  }

  function berekenTotaalprijs(r: Recept): number {
    return r.regels.reduce((t, regel) => t + berekenRegelKostprijs(regel), 0);
  }

  const resetForm = () => {
    setRecept({ naam: "", regels: [] });
    setOpenReceptId(null);
  };

  if (productenError || receptenError) {
    return (
      <main className="min-h-screen bg-slate-100 px-6 py-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-red-700">
          Fout bij laden receptbeheer.
        </div>
      </main>
    );
  }

  if (!producten || !recepten) {
    return (
      <main className="min-h-screen bg-slate-100 px-6 py-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Recepten laden…</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-600">
                <BookOpenText className="h-4 w-4" />
                Producten / Receptbeheer
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Receptbeheer
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Beheer samengestelde producten, receptregels en kostprijzen.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-xl bg-blue-50 px-4 py-3 ring-1 ring-blue-100">
                <div className="text-xs font-medium uppercase tracking-wide text-blue-600">
                  Recepten
                </div>
                <div className="text-2xl font-bold text-blue-950">
                  {recepten.length}
                </div>
              </div>

              <div className="rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
                <div className="text-xs font-medium uppercase tracking-wide text-emerald-600">
                  Producten
                </div>
                <div className="text-2xl font-bold text-emerald-950">
                  {producten.length}
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                {recept.id ? "Recept bewerken" : "Nieuw recept"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Voeg ingrediënten toe en koppel het recept eventueel aan een product.
              </p>
            </div>

            {recept.id && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Nieuw recept
              </button>
            )}
          </div>

          <form
            className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2"
            onSubmit={async (e) => {
              e.preventDefault();

              await fetch("/api/recepten", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  ...recept,
                  regels: recept.regels.filter(
                    (r) => r.product_id && r.hoeveelheid > 0
                  ),
                }),
              });

              mutate("/api/recepten");
              resetForm();
            }}
          >
            <label>
              <span className="mb-1 block font-semibold text-slate-700">
                Categorie
              </span>
              <select
                value={recept.omschrijving || ""}
                onChange={(e) =>
                  setRecept({ ...recept, omschrijving: e.target.value })
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">-- Kies categorie --</option>
                {categorieen.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block font-semibold text-slate-700">
                Naam recept
              </span>
              <input
                type="text"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                value={recept.naam}
                onChange={(e) => setRecept({ ...recept, naam: e.target.value })}
              />
            </label>

            <label>
              <span className="mb-1 block font-semibold text-slate-700">
                Totaaloutput
              </span>
              <input
                type="number"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                value={recept.totaal_output || ""}
                onChange={(e) =>
                  setRecept({
                    ...recept,
                    totaal_output: parseFloat(e.target.value),
                  })
                }
              />
            </label>

            <label>
              <span className="mb-1 block font-semibold text-slate-700">
                Eenheid output
              </span>
              <select
                value={recept.eenheid || ""}
                onChange={(e) => setRecept({ ...recept, eenheid: e.target.value })}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">-- eenheid --</option>
                <option value="g">g</option>
                <option value="kg">kg</option>
                <option value="ml">ml</option>
                <option value="l">l</option>
              </select>
            </label>

            <label className="md:col-span-2">
              <span className="mb-1 block font-semibold text-slate-700">
                Koppel product
              </span>
              <select
                value={recept.product_id || ""}
                onChange={(e) =>
                  setRecept({ ...recept, product_id: +e.target.value })
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                <option value="">-- Koppel product --</option>
                {producten.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.naam}
                  </option>
                ))}
              </select>
            </label>

            <div className="md:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-bold text-slate-950">Ingrediënten</h3>

                <button
                  type="button"
                  onClick={() =>
                    setRecept({
                      ...recept,
                      regels: [
                        ...recept.regels,
                        { product_id: 0, hoeveelheid: 0, eenheid: "g" },
                      ],
                    })
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 ring-1 ring-blue-100 transition hover:bg-blue-100"
                >
                  <Plus size={15} />
                  Regel toevoegen
                </button>
              </div>

              <div className="space-y-3">
                {recept.regels.map((regel, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 md:grid-cols-[1fr_140px_120px_auto]"
                  >
                    <div>
                      <input
                        type="text"
                        placeholder="Zoek product..."
                        className="mb-2 h-10 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                        value={regel.product_naam || ""}
                        onChange={(e) =>
                          wijzigRegel(i, "product_naam", e.target.value)
                        }
                      />

                      <select
                        value={regel.product_id}
                        onChange={(e) =>
                          wijzigRegel(i, "product_id", +e.target.value)
                        }
                        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                      >
                        <option value="">-- kies product --</option>
                        {producten
                          .filter(
                            (p) =>
                              !regel.product_naam ||
                              p.naam
                                .toLowerCase()
                                .includes(regel.product_naam.toLowerCase())
                          )
                          .map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.naam}
                            </option>
                          ))}
                      </select>
                    </div>

                    <input
                      type="number"
                      placeholder="Hoeveelheid"
                      value={regel.hoeveelheid}
                      onChange={(e) =>
                        wijzigRegel(i, "hoeveelheid", +e.target.value)
                      }
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                    />

                    <select
                      value={regel.eenheid}
                      onChange={(e) => wijzigRegel(i, "eenheid", e.target.value)}
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                    >
                      <option value="g">g</option>
                      <option value="kg">kg</option>
                      <option value="ml">ml</option>
                      <option value="l">l</option>
                    </select>

                    <button
                      type="button"
                      onClick={() =>
                        setRecept({
                          ...recept,
                          regels: recept.regels.filter((_, idx) => idx !== i),
                        })
                      }
                      className="inline-flex h-10 items-center justify-center rounded-xl text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                      title="Regel verwijderen"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}

                {recept.regels.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                    Nog geen ingrediënten toegevoegd.
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-2">
              <button
                type="submit"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <Save size={16} />
                Recept opslaan
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-5 text-xl font-bold text-slate-950">
            Bestaande recepten
          </h2>

          <div className="space-y-6">
            {categorieen.map((cat) => {
              const items = recepten.filter((r) => r.omschrijving === cat);

              if (items.length === 0) return null;

              return (
                <div key={cat}>
                  <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-slate-500">
                    {cat}
                  </h3>

                  <div className="space-y-2">
                    {items.map((r) => {
                      const totaal = berekenTotaalprijs(r);
                      const isOpen = openReceptId === (r.id ?? null);

                      return (
                        <div
                          key={r.id}
                          className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setOpenReceptId(isOpen ? null : r.id ?? null);
                              setRecept({
                                id: r.id,
                                naam: r.naam,
                                omschrijving: r.omschrijving,
                                totaal_output: r.totaal_output,
                                eenheid: r.eenheid,
                                product_id: r.product_id,
                                regels: r.regels.map((rg) => ({
                                  product_id: rg.product_id,
                                  hoeveelheid: rg.hoeveelheid,
                                  eenheid: rg.eenheid,
                                  product_naam: producten.find(
                                    (p) => p.id === rg.product_id
                                  )?.naam,
                                })),
                              });
                            }}
                            className="flex w-full items-center justify-between gap-3 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100"
                          >
                            <div className="flex min-w-0 items-center gap-2">
                              {isOpen ? (
                                <ChevronDown className="h-4 w-4 text-slate-400" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-slate-400" />
                              )}
                              <span className="truncate font-semibold text-slate-950">
                                {r.naam}
                              </span>
                            </div>

                            <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-100">
                              € {totaal.toFixed(2)}
                            </span>
                          </button>

                          {isOpen && (
                            <div className="border-t border-slate-200 bg-white p-4 text-sm">
                              <div className="space-y-2">
                                {r.regels.map((rg, idx) => {
                                  const prod = producten.find(
                                    (p) => p.id === rg.product_id
                                  );
                                  const prijs = berekenRegelKostprijs(rg);

                                  return (
                                    <div
                                      key={idx}
                                      className="flex justify-between gap-4 rounded-xl bg-slate-50 px-3 py-2"
                                    >
                                      <span className="text-slate-700">
                                        {prod?.naam ?? "?"} ({rg.hoeveelheid}{" "}
                                        {rg.eenheid})
                                      </span>
                                      <span className="font-semibold text-slate-950">
                                        € {prijs.toFixed(2)}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <ScrollToTopButton />
      </div>
    </main>
  );
}

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Fout bij ophalen");
  return res.json();
}