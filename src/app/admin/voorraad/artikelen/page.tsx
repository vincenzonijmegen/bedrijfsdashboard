"use client";

import useSWR, { mutate } from "swr";
import { useEffect, useState } from "react";
import {
  Archive,
  CheckCircle2,
  Loader2,
  Package,
  Pencil,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import ScrollToTopButton from "@/components/ScrollToTopButton";

interface Leverancier {
  id: number;
  naam: string;
}

interface Product {
  id: number;
  naam: string;
  bestelnummer?: string;
  minimum_voorraad?: number;
  besteleenheid?: number;
  huidige_prijs?: number;
  inhoud?: number;
  eenheid?: string;
  is_samengesteld?: boolean;
  actief: boolean;
  volgorde?: number;
}

async function fetcher(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error("Fout bij ophalen");
  return res.json();
}

export default function Productbeheer() {
  const [leverancierId, setLeverancierId] = useState<number | null>(null);
  const [nieuweLeverancier, setNieuweLeverancier] = useState("");
  const [naam, setNaam] = useState("");
  const [bestelnummer, setBestelnummer] = useState("");
  const [minimumVoorraad, setMinimumVoorraad] = useState<number | undefined>();
  const [besteleenheid, setBesteleenheid] = useState<number>(1);
  const [prijs, setPrijs] = useState<number | undefined>();
  const [inhoud, setInhoud] = useState<number | undefined>();
  const [eenheid, setEenheid] = useState<string>("g");
  const [isSamengesteld, setIsSamengesteld] = useState(false);
  const [actief, setActief] = useState(true);
  const [volgorde, setVolgorde] = useState<number | undefined>();
  const [productId, setProductId] = useState<number | null>(null);

  const { data: leveranciers, error: leveranciersError } = useSWR<
    Leverancier[]
  >("/api/leveranciers", fetcher);

  const { data: producten } = useSWR<Product[]>(
    leverancierId ? `/api/producten?leverancier=${leverancierId}` : null,
    fetcher
  );

  useEffect(() => {
    if (leverancierId) {
      mutate(`/api/producten?leverancier=${leverancierId}`);
    }
  }, [leverancierId]);

  const resetForm = () => {
    setProductId(null);
    setNaam("");
    setBestelnummer("");
    setMinimumVoorraad(undefined);
    setBesteleenheid(1);
    setPrijs(undefined);
    setInhoud(undefined);
    setEenheid("g");
    setIsSamengesteld(false);
    setActief(true);
    setNieuweLeverancier("");
    setVolgorde(undefined);
  };

  const geselecteerdeLeverancier = leveranciers?.find(
    (l) => l.id === leverancierId
  );

  const totaalProducten = producten?.length ?? 0;
  const actieveProducten = producten?.filter((p) => p.actief).length ?? 0;

  if (leveranciersError) {
    return (
      <div className="min-h-screen bg-slate-100 px-6 py-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-red-700">
          Fout bij laden leveranciers.
        </div>
      </div>
    );
  }

  if (!leveranciers) {
    return (
      <div className="min-h-screen bg-slate-100 px-6 py-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Productbeheer laden…</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-600">
                <Package className="h-4 w-4" />
                Voorraad / Productbeheer
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Productbeheer
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Beheer producten, besteleenheden, prijzen en leveranciers.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-xl bg-blue-50 px-4 py-3 ring-1 ring-blue-100">
                <div className="text-xs font-medium uppercase tracking-wide text-blue-600">
                  Leveranciers
                </div>
                <div className="text-2xl font-bold text-blue-950">
                  {leveranciers.length}
                </div>
              </div>

              <div className="rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
                <div className="text-xs font-medium uppercase tracking-wide text-emerald-600">
                  Actief
                </div>
                <div className="text-2xl font-bold text-emerald-950">
                  {actieveProducten}
                </div>
              </div>
            </div>
          </div>
        </div>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                {productId ? "Product bewerken" : "Nieuw product toevoegen"}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                Kies een bestaande leverancier of maak direct een nieuwe aan.
              </p>
            </div>

            {productId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Annuleren
              </button>
            )}
          </div>

          <form
            className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2 lg:grid-cols-4"
            onSubmit={async (e) => {
              e.preventDefault();

              const response = await fetch("/api/producten", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  id: productId,
                  leverancier_id: leverancierId,
                  nieuwe_leverancier: nieuweLeverancier || undefined,
                  naam,
                  bestelnummer,
                  minimum_voorraad: minimumVoorraad,
                  besteleenheid,
                  prijs: isSamengesteld ? undefined : prijs,
                  inhoud,
                  eenheid,
                  is_samengesteld: isSamengesteld,
                  actief,
                  volgorde,
                }),
              });

              if (response.ok) {
                resetForm();
                if (leverancierId) {
                  mutate(`/api/producten?leverancier=${leverancierId}`);
                }
                mutate("/api/leveranciers");
              } else {
                const fout = await response.json();
                alert("Fout: " + fout.error);
              }
            }}
          >
            <label className="lg:col-span-2">
              <span className="mb-1 block font-semibold text-slate-700">
                Bestaande leverancier
              </span>
              <select
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                value={leverancierId ?? ""}
                onChange={(e) =>
                  setLeverancierId(e.target.value ? Number(e.target.value) : null)
                }
              >
                <option value="">-- Kies leverancier --</option>
                {leveranciers.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.naam}
                  </option>
                ))}
              </select>
            </label>

            <label className="lg:col-span-2">
              <span className="mb-1 block font-semibold text-slate-700">
                Nieuwe leverancier
              </span>
              <input
                type="text"
                placeholder="Nieuwe leverancier"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                value={nieuweLeverancier}
                onChange={(e) => setNieuweLeverancier(e.target.value)}
              />
            </label>

            <label className="lg:col-span-2">
              <span className="mb-1 block font-semibold text-slate-700">
                Productnaam
              </span>
              <input
                type="text"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                value={naam}
                onChange={(e) => setNaam(e.target.value)}
              />
            </label>

            <label>
              <span className="mb-1 block font-semibold text-slate-700">
                Bestelnummer
              </span>
              <input
                type="text"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                value={bestelnummer}
                onChange={(e) => setBestelnummer(e.target.value)}
              />
            </label>

            <label>
              <span className="mb-1 block font-semibold text-slate-700">
                Volgorde
              </span>
              <input
                type="number"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                value={volgorde ?? ""}
                onChange={(e) =>
                  setVolgorde(e.target.value ? Number(e.target.value) : undefined)
                }
              />
            </label>

            <label>
              <span className="mb-1 block font-semibold text-slate-700">
                Min. voorraad
              </span>
              <input
                type="number"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                value={minimumVoorraad ?? ""}
                onChange={(e) =>
                  setMinimumVoorraad(
                    e.target.value ? Number(e.target.value) : undefined
                  )
                }
              />
            </label>

            <label>
              <span className="mb-1 block font-semibold text-slate-700">
                Besteleenheid
              </span>
              <input
                type="number"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                value={besteleenheid}
                onChange={(e) => setBesteleenheid(Number(e.target.value))}
              />
            </label>

            <label>
              <span className="mb-1 block font-semibold text-slate-700">
                Prijs (€)
              </span>
              <input
                type="number"
                step="0.01"
                disabled={isSamengesteld}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100 disabled:bg-slate-100 disabled:text-slate-400"
                value={prijs ?? ""}
                onChange={(e) =>
                  setPrijs(e.target.value ? Number(e.target.value) : undefined)
                }
              />
            </label>

            <label>
              <span className="mb-1 block font-semibold text-slate-700">
                Inhoud
              </span>
              <input
                type="number"
                step="0.01"
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                value={inhoud ?? ""}
                onChange={(e) =>
                  setInhoud(e.target.value ? Number(e.target.value) : undefined)
                }
              />
            </label>

            <label>
              <span className="mb-1 block font-semibold text-slate-700">
                Eenheid
              </span>
              <select
                value={eenheid}
                onChange={(e) => setEenheid(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                <option value="g">gram</option>
                <option value="kg">kilogram</option>
                <option value="ml">milliliter</option>
                <option value="l">liter</option>
                <option value="batch">batch</option>
              </select>
            </label>

            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <input
                type="checkbox"
                checked={isSamengesteld}
                onChange={(e) => setIsSamengesteld(e.target.checked)}
                className="h-4 w-4 accent-blue-600"
              />
              <span className="text-sm font-semibold text-slate-700">
                Samengesteld product
              </span>
            </div>

            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <input
                type="checkbox"
                checked={actief}
                onChange={(e) => setActief(e.target.checked)}
                className="h-4 w-4 accent-blue-600"
              />
              <span className="text-sm font-semibold text-slate-700">Actief</span>
            </div>

            <div className="md:col-span-2 lg:col-span-4">
              <button
                type="submit"
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <Save size={16} />
                {productId ? "Wijzigingen opslaan" : "Product opslaan"}
              </button>
            </div>
          </form>
        </section>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3">
            <h2 className="text-lg font-bold text-slate-950">
              Producten bekijken
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Selecteer een leverancier om de gekoppelde producten te tonen.
            </p>
          </div>

          <select
            className="h-11 w-full max-w-md rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            value={leverancierId ?? ""}
            onChange={(e) =>
              setLeverancierId(e.target.value ? Number(e.target.value) : null)
            }
          >
            <option value="">-- Kies leverancier --</option>
            {leveranciers.map((l) => (
              <option key={l.id} value={l.id}>
                {l.naam}
              </option>
            ))}
          </select>
        </section>

        {leverancierId && (
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                  <Archive size={20} />
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-950">
                    {geselecteerdeLeverancier?.naam ?? "Producten"}
                  </h2>
                  <p className="text-sm text-slate-500">
                    {totaalProducten} product
                    {totaalProducten === 1 ? "" : "en"} gevonden.
                  </p>
                </div>
              </div>
            </div>

            {!producten ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">
                Laden…
              </div>
            ) : producten.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">
                Geen producten gevonden voor deze leverancier.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="border-b border-slate-200 px-4 py-3 text-left">
                        Naam
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left">
                        Bestelnummer
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left">
                        Min
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left">
                        Eenh.
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left">
                        Prijs
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left">
                        Volgorde
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3 text-left">
                        Actief
                      </th>
                      <th className="border-b border-slate-200 px-4 py-3 text-right">
                        Acties
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {producten.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-semibold text-slate-950">
                          {p.naam}
                        </td>

                        <td className="px-4 py-3 text-slate-600">
                          {p.bestelnummer || "—"}
                        </td>

                        <td className="px-4 py-3 text-slate-700">
                          {p.minimum_voorraad ?? "—"}
                        </td>

                        <td className="px-4 py-3 text-slate-700">
                          {p.besteleenheid ?? "—"}
                        </td>

                        <td className="px-4 py-3 font-medium text-slate-900">
                          {p.huidige_prijs != null
                            ? `€ ${Number(p.huidige_prijs).toFixed(2)}`
                            : "—"}
                        </td>

                        <td className="px-4 py-3 text-slate-700">
                          {p.volgorde ?? "—"}
                        </td>

                        <td className="px-4 py-3">
                          {p.actief ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                              <CheckCircle2 size={13} />
                              Actief
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200">
                              Inactief
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3 text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => {
                                window.scrollTo({ top: 0, behavior: "smooth" });
                                setProductId(p.id);
                                setNaam(p.naam);
                                setBestelnummer(p.bestelnummer ?? "");
                                setMinimumVoorraad(p.minimum_voorraad);
                                setBesteleenheid(p.besteleenheid ?? 1);
                                setPrijs(p.huidige_prijs);
                                setVolgorde(p.volgorde);
                                setInhoud(p.inhoud);
                                setEenheid(p.eenheid ?? "g");
                                setIsSamengesteld(!!p.is_samengesteld);
                                setActief(p.actief);
                                setNieuweLeverancier("");
                              }}
                              className="rounded-lg p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                              title="Bewerken"
                            >
                              <Pencil size={16} />
                            </button>

                            <button
                              onClick={async () => {
                                if (
                                  !confirm(
                                    `Weet je zeker dat je ${p.naam} wilt verwijderen?`
                                  )
                                ) {
                                  return;
                                }

                                await fetch(`/api/producten?id=${p.id}`, {
                                  method: "DELETE",
                                });

                                if (leverancierId) {
                                  mutate(
                                    `/api/producten?leverancier=${leverancierId}`
                                  );
                                }
                              }}
                              className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                              title="Verwijderen"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <ScrollToTopButton />
      </div>
    </main>
  );
}