"use client";

import { useEffect, useState } from "react";
import {
  BriefcaseBusiness,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

interface Functie {
  id: number;
  naam: string;
  omschrijving: string;
}

export default function FunctieBeheer() {
  const [nieuweFunctie, setNieuweFunctie] = useState({
    naam: "",
    omschrijving: "",
  });
  const [functies, setFuncties] = useState<Functie[]>([]);
  const [succes, setSucces] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/functies")
      .then((res) => res.json())
      .then((data) => setFuncties(data))
      .finally(() => setLoading(false));
  }, [succes]);

  const updateFunctie = (index: number, veld: string, waarde: string) => {
    const kopie = [...functies];
    (kopie[index] as any)[veld] = waarde;
    setFuncties(kopie);
  };

  const opslaan = async (functie: Functie) => {
    const res = await fetch("/api/functies", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(functie),
    });

    if (res.ok) setSucces((prev) => !prev);
  };

  const verwijderen = async (id: number) => {
    if (!confirm("Weet je zeker dat je deze functie wilt verwijderen?")) return;

    const res = await fetch(`/api/functies?id=${id}`, { method: "DELETE" });

    if (res.ok) setSucces((prev) => !prev);
    else {
      alert(
        "Kan functie niet verwijderen. Mogelijk is deze nog gekoppeld aan een medewerker."
      );
    }
  };

  const toevoegen = async () => {
    if (!nieuweFunctie.naam.trim()) return;

    const res = await fetch("/api/functies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(nieuweFunctie),
    });

    if (res.ok) {
      setSucces((prev) => !prev);
      setNieuweFunctie({ naam: "", omschrijving: "" });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 px-6 py-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Functies laden…</p>
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
                <BriefcaseBusiness className="h-4 w-4" />
                Personeel / Functies
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Functiebeheer
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Beheer functies en omschrijvingen die gekoppeld kunnen worden aan
                medewerkers.
              </p>
            </div>

            <div className="rounded-xl bg-blue-50 px-4 py-3 ring-1 ring-blue-100">
              <div className="text-xs font-medium uppercase tracking-wide text-blue-600">
                Functies
              </div>
              <div className="text-2xl font-bold text-blue-950">
                {functies.length}
              </div>
            </div>
          </div>
        </div>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-slate-950">
              Nieuwe functie toevoegen
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Voeg een nieuwe rol toe voor personeel of planning.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-[240px_1fr_auto]">
            <input
              type="text"
              placeholder="Naam"
              value={nieuweFunctie.naam}
              onChange={(e) =>
                setNieuweFunctie({ ...nieuweFunctie, naam: e.target.value })
              }
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            />

            <input
              type="text"
              placeholder="Omschrijving (optioneel)"
              value={nieuweFunctie.omschrijving}
              onChange={(e) =>
                setNieuweFunctie({
                  ...nieuweFunctie,
                  omschrijving: e.target.value,
                })
              }
              className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            />

            <button
              onClick={toevoegen}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus size={16} />
              Toevoegen
            </button>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-950">
              Bestaande functies
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Pas naam of omschrijving aan en sla per functie op.
            </p>
          </div>

          {functies.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">
              Nog geen functies aangemaakt.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {functies.map((f, i) => (
                <div
                  key={f.id}
                  className="grid grid-cols-1 gap-3 px-5 py-4 transition hover:bg-slate-50 lg:grid-cols-[240px_1fr_auto]"
                >
                  <input
                    type="text"
                    value={f.naam}
                    onChange={(e) => updateFunctie(i, "naam", e.target.value)}
                    className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-950 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  />

                  <textarea
                    value={f.omschrijving || ""}
                    onChange={(e) =>
                      updateFunctie(i, "omschrijving", e.target.value)
                    }
                    className="min-h-[90px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                    placeholder="Omschrijving..."
                  />

                  <div className="flex items-start gap-2">
                    <button
                      onClick={() => opslaan(f)}
                      className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                    >
                      <Save size={16} />
                      Opslaan
                    </button>

                    <button
                      onClick={() => verwijderen(f.id)}
                      className="inline-flex h-11 items-center justify-center rounded-xl px-3 text-red-600 transition hover:bg-red-50"
                      title="Verwijderen"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}