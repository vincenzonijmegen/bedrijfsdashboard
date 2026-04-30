"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Building2,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

interface Leverancier {
  id: number;
  naam: string;
  soort: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function LeveranciersPage() {
  const { data: leveranciers, error, mutate } = useSWR<Leverancier[]>(
    "/api/leveranciers",
    fetcher
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [bewerkt, setBewerkt] = useState<Partial<Leverancier>>({
    naam: "",
    soort: "",
  });

  const openNieuw = () => {
    setBewerkt({ naam: "", soort: "" });
    setModalOpen(true);
  };

  const openBewerk = (l: Leverancier) => {
    setBewerkt(l);
    setModalOpen(true);
  };

  const opslaan = async () => {
    const method = bewerkt.id ? "PUT" : "POST";

    await fetch("/api/leveranciers", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(bewerkt),
    });

    mutate();
    setModalOpen(false);
  };

  const verwijderen = async (id: number) => {
    if (!confirm("Weet je zeker dat je deze leverancier wilt verwijderen?")) {
      return;
    }

    await fetch(`/api/leveranciers?id=${id}`, { method: "DELETE" });
    mutate();
  };

  if (error) {
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
          <p className="text-sm text-slate-500">Leveranciers laden…</p>
        </div>
      </div>
    );
  }

  const wekelijks = leveranciers.filter((l) => l.soort === "wekelijks").length;
  const incidenteel = leveranciers.filter((l) => l.soort === "incidenteel").length;

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-600">
                <Building2 className="h-4 w-4" />
                Beheer / Leveranciers
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Leveranciers
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Beheer vaste en incidentele leveranciers.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="rounded-xl bg-blue-50 px-4 py-3 ring-1 ring-blue-100">
                <div className="text-xs font-medium uppercase tracking-wide text-blue-600">
                  Totaal
                </div>
                <div className="text-2xl font-bold text-blue-950">
                  {leveranciers.length}
                </div>
              </div>

              <div className="rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
                <div className="text-xs font-medium uppercase tracking-wide text-emerald-600">
                  Wekelijks
                </div>
                <div className="text-2xl font-bold text-emerald-950">
                  {wekelijks}
                </div>
              </div>

              <button
                onClick={openNieuw}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <Plus size={16} />
                Nieuwe leverancier
              </button>
            </div>
          </div>
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-950">
              Leverancierslijst
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {incidenteel} incidenteel, {wekelijks} wekelijks.
            </p>
          </div>

          {leveranciers.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">
              Nog geen leveranciers aangemaakt.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="border-b border-slate-200 px-4 py-3 text-left">
                    Naam
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left">
                    Soort
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-right">
                    Acties
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {leveranciers.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-semibold text-slate-950">
                      {l.naam}
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                          l.soort === "wekelijks"
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : "bg-slate-50 text-slate-700 ring-slate-200"
                        }`}
                      >
                        {l.soort || "Onbekend"}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openBewerk(l)}
                          className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                          title="Bewerken"
                        >
                          <Pencil size={16} />
                        </button>

                        <button
                          onClick={() => verwijderen(l.id)}
                          className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
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
          )}
        </section>

        {modalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
            <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <h2 className="text-lg font-bold text-slate-950">
                  {bewerkt.id ? "Leverancier bewerken" : "Nieuwe leverancier"}
                </h2>

                <button
                  onClick={() => setModalOpen(false)}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <X size={18} />
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  opslaan();
                }}
                className="space-y-4 p-6"
              >
                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-slate-700">
                    Naam
                  </span>
                  <input
                    type="text"
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                    value={bewerkt.naam || ""}
                    onChange={(e) =>
                      setBewerkt({ ...bewerkt, naam: e.target.value })
                    }
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-sm font-semibold text-slate-700">
                    Soort
                  </span>
                  <select
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                    value={bewerkt.soort || ""}
                    onChange={(e) =>
                      setBewerkt({ ...bewerkt, soort: e.target.value })
                    }
                  >
                    <option value="">Selecteer soort</option>
                    <option value="wekelijks">Wekelijks</option>
                    <option value="incidenteel">Incidenteel</option>
                  </select>
                </label>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                  >
                    Annuleren
                  </button>

                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                  >
                    <Save size={16} />
                    Opslaan
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}