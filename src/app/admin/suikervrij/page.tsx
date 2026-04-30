"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  IceCreamBowl,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

interface Productie {
  id: number;
  smaak: string;
  datum: string;
  aantal: number;
  kleur: string;
}

export default function SuikervrijPage() {
  const [bewerken, setBewerken] = useState<Productie | null>(null);
  const [lijst, setLijst] = useState<Productie[]>([]);
  const [smakenlijst, setSmakenlijst] = useState<string[]>([]);
  const [kleurenlijst, setKleurenlijst] = useState<
    { naam: string; hexcode: string }[]
  >([]);
  const [smaak, setSmaak] = useState("");
  const [datum, setDatum] = useState(() =>
    new Date().toISOString().substring(0, 10)
  );
  const [aantal, setAantal] = useState(0);
  const [kleur, setKleur] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    const res = await fetch("/api/suikervrij/productie");
    const data = await res.json();
    setLijst(data);
  };

  useEffect(() => {
    async function load() {
      try {
        await fetchData();

        const smakenRes = await fetch("/api/suikervrij/smaken");
        const smakenData = await smakenRes.json();
        const namen = smakenData.map((d: any) => d.naam);
        setSmakenlijst(namen);
        setSmaak(namen[0] || "");

        const kleurenRes = await fetch("/api/suikervrij/kleuren");
        const kleurenData = await kleurenRes.json();
        setKleurenlijst(kleurenData);
        setKleur(kleurenData[0]?.naam || "");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const totaalProducties = lijst.length;
  const totaalAantal = useMemo(
    () => lijst.reduce((sum, item) => sum + Number(item.aantal || 0), 0),
    [lijst]
  );

  const kleurHex = (kleurNaam: string) =>
    kleurenlijst.find((k) => k.naam === kleurNaam)?.hexcode || "#cbd5e1";

  const toevoegen = async () => {
    if (!aantal) return;

    await fetch("/api/suikervrij/productie", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ smaak, datum, aantal, kleur }),
    });

    setAantal(0);
    await fetchData();
  };

  const verwijder = async (id: number) => {
    if (!confirm("Weet je zeker dat je deze productie wilt verwijderen?")) return;

    await fetch("/api/suikervrij/productie", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    await fetchData();
  };

  const openEdit = (p: Productie) => setBewerken(p);

  const saveEdit = async () => {
    if (!bewerken) return;

    await fetch("/api/suikervrij/productie", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bewerken),
    });

    setBewerken(null);
    await fetchData();
  };

  const savePdf = async () => {
    // @ts-expect-error html2pdf.js heeft geen types
    const html2pdf = (await import("html2pdf.js")).default;
    const element = document.querySelector(".print-area") as HTMLElement;
    if (!element) return;

    html2pdf()
      .from(element)
      .set({
        margin: [36, 36, 36, 36],
        filename: "suikervrij-producties.pdf",
        jsPDF: {
          unit: "pt",
          format: "a4",
          orientation: "portrait",
        },
        html2canvas: {
          scale: 2,
          useCORS: true,
        },
      })
      .save();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 px-6 py-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Producties laden…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-600">
                <IceCreamBowl className="h-4 w-4" />
                Productie / Suikervrij
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Productie suikervrij ijs
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Registreer producties en stickerkleuren per smaak.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-xl bg-blue-50 px-4 py-3 ring-1 ring-blue-100">
                <div className="text-xs font-medium uppercase tracking-wide text-blue-600">
                  Producties
                </div>
                <div className="text-2xl font-bold text-blue-950">
                  {totaalProducties}
                </div>
              </div>

              <div className="rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
                <div className="text-xs font-medium uppercase tracking-wide text-emerald-600">
                  Stuks
                </div>
                <div className="text-2xl font-bold text-emerald-950">
                  {totaalAantal}
                </div>
              </div>

              <button
                onClick={savePdf}
                className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <Download size={16} />
                PDF laatste 4
              </button>
            </div>
          </div>
        </div>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-950">
              Nieuwe productie toevoegen
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Kies smaak, datum, aantal en stickerkleur.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <label>
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Smaak
              </span>
              <select
                value={smaak}
                onChange={(e) => setSmaak(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                {smakenlijst.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Datum
              </span>
              <input
                type="date"
                value={datum}
                onChange={(e) => setDatum(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label>
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Aantal
              </span>
              <input
                type="number"
                value={aantal}
                onChange={(e) => setAantal(parseInt(e.target.value) || 0)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              />
            </label>

            <label>
              <span className="mb-1 block text-sm font-semibold text-slate-700">
                Kleur sticker
              </span>
              <select
                value={kleur}
                onChange={(e) => setKleur(e.target.value)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
              >
                {kleurenlijst.map((k) => (
                  <option key={k.naam} value={k.naam}>
                    {k.naam}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button
            onClick={toevoegen}
            className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
          >
            <Plus size={16} />
            Toevoegen
          </button>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-950">
              Producties per smaak
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Nieuwste producties staan bovenaan.
            </p>
          </div>

          <div className="space-y-5">
            {smakenlijst.map((smaakNaam) => {
              const items = lijst
                .filter((p) => p.smaak === smaakNaam)
                .sort(
                  (a, b) =>
                    new Date(b.datum).getTime() - new Date(a.datum).getTime()
                );

              if (!items.length) return null;

              return (
                <div
                  key={smaakNaam}
                  className="overflow-hidden rounded-2xl border border-slate-200"
                >
                  <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <h3 className="font-bold text-slate-950">{smaakNaam}</h3>
                    <p className="text-xs text-slate-500">
                      {items.length} productie{items.length === 1 ? "" : "s"}
                    </p>
                  </div>

                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="border-b border-slate-200 px-4 py-3 text-left">
                          Datum
                        </th>
                        <th className="border-b border-slate-200 px-4 py-3 text-left">
                          Aantal
                        </th>
                        <th className="border-b border-slate-200 px-4 py-3 text-left">
                          Kleur
                        </th>
                        <th className="border-b border-slate-200 px-4 py-3 text-right">
                          Acties
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {items.map((p) => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {new Date(p.datum).toLocaleDateString("nl-NL")}
                          </td>

                          <td className="px-4 py-3 text-slate-700">
                            {p.aantal}
                          </td>

                          <td className="px-4 py-3">
                            <span className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                              <span
                                className="h-4 w-4 rounded-full ring-1 ring-slate-300"
                                style={{ backgroundColor: kleurHex(p.kleur) }}
                              />
                              {p.kleur}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => openEdit(p)}
                                className="rounded-lg p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                                title="Bewerken"
                              >
                                <Pencil size={16} />
                              </button>

                              <button
                                onClick={() => verwijder(p.id)}
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
              );
            })}

            {lijst.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                Nog geen producties geregistreerd.
              </div>
            )}
          </div>
        </section>

        <div className="print-area mt-8 bg-white p-6 text-slate-900">
          <h2 className="mb-4 text-xl font-bold">
            Print – laatste 4 producties per smaak
          </h2>

          {smakenlijst.map((smaakNaam) => {
            const items = lijst
              .filter((p) => p.smaak === smaakNaam)
              .sort(
                (a, b) =>
                  new Date(b.datum).getTime() - new Date(a.datum).getTime()
              )
              .slice(0, 4);

            if (!items.length) return null;

            return (
              <div key={smaakNaam} className="mb-5 break-inside-avoid">
                <h3 className="mb-2 font-bold">{smaakNaam}</h3>

                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className="border px-2 py-1 text-left">Datum</th>
                      <th className="border px-2 py-1 text-left">Aantal</th>
                      <th className="border px-2 py-1 text-left">Kleur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => (
                      <tr key={p.id}>
                        <td className="border px-2 py-1">
                          {new Date(p.datum).toLocaleDateString("nl-NL")}
                        </td>
                        <td className="border px-2 py-1">{p.aantal}</td>
                        <td className="border px-2 py-1">
                          <span
                            className="mr-2 inline-block h-4 w-4 rounded-full align-middle"
                            style={{ backgroundColor: kleurHex(p.kleur) }}
                          />
                          {p.kleur}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>

        {bewerken && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
            <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <h2 className="text-lg font-bold text-slate-950">
                  Productie bewerken
                </h2>

                <button
                  onClick={() => setBewerken(null)}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4 p-6">
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-slate-700">
                    Datum
                  </span>
                  <input
                    type="date"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                    value={bewerken.datum}
                    onChange={(e) =>
                      setBewerken({ ...bewerken, datum: e.target.value })
                    }
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-slate-700">
                    Aantal
                  </span>
                  <input
                    type="number"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                    value={bewerken.aantal}
                    onChange={(e) =>
                      setBewerken({
                        ...bewerken,
                        aantal: parseInt(e.target.value) || 0,
                      })
                    }
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-slate-700">
                    Kleur sticker
                  </span>
                  <select
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                    value={bewerken.kleur}
                    onChange={(e) =>
                      setBewerken({ ...bewerken, kleur: e.target.value })
                    }
                  >
                    {kleurenlijst.map((k) => (
                      <option key={k.naam} value={k.naam}>
                        {k.naam}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setBewerken(null)}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                  >
                    Annuleren
                  </button>

                  <button
                    onClick={saveEdit}
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    <Save size={16} />
                    Opslaan
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}