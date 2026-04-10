"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

type Ingredient = {
  naam: string;
  gewicht: string;
};

const categorieen = [
  { value: "melksmaken", label: "Melksmaken" },
  { value: "vruchtensmaken", label: "Vruchtensmaken" },
  { value: "suikervrij", label: "Suikervrij" },
  { value: "sauzen", label: "Sauzen" },
];

export default function BewerkReceptPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [naam, setNaam] = useState("");
  const [maakvolgorde, setMaakvolgorde] = useState(50);
  const [categorie, setCategorie] = useState("melksmaken");
  const [hoeveelheidMix, setHoeveelheidMix] = useState("");
  const [voorbereiding, setVoorbereiding] = useState("");
  const [draaien, setDraaien] = useState("");
  const [actief, setActief] = useState(true);
  const [ingredienten, setIngredienten] = useState<Ingredient[]>([
    { naam: "", gewicht: "" },
  ]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");

        const res = await fetch(`/api/admin/recepturen/${id}`);
        const data = await res.json();

        if (!res.ok || !data.success) {
          setError(data.error || "Fout bij laden");
          setLoading(false);
          return;
        }

        const recept = data.recept;

        setNaam(recept.naam || "");
        setMaakvolgorde(recept.maakvolgorde ?? 50);
        setCategorie(recept.categorie || "melksmaken");
        setHoeveelheidMix(recept.hoeveelheid_mix || "");
        setVoorbereiding(recept.voorbereiding || "");
        setDraaien(recept.draaien || "");
        setActief(recept.actief !== false);
        setIngredienten(
          Array.isArray(recept.ingredienten) && recept.ingredienten.length > 0
            ? recept.ingredienten
            : [{ naam: "", gewicht: "" }]
        );
      } catch (error) {
        console.error(error);
        setError("Fout bij laden");
      } finally {
        setLoading(false);
      }
    }

    if (id) load();
  }, [id]);

  function updateIngredient(
    index: number,
    field: keyof Ingredient,
    value: string
  ) {
    setIngredienten((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      )
    );
  }

  function addIngredient() {
    setIngredienten((prev) => [...prev, { naam: "", gewicht: "" }]);
  }

  function removeIngredient(index: number) {
    setIngredienten((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");

    try {
      const res = await fetch(`/api/admin/recepturen/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          naam,
          categorie,
          hoeveelheid_mix: hoeveelheidMix,
          voorbereiding,
          draaien,
          actief,
          maakvolgorde,
          ingredienten,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Opslaan mislukt");
        setSaving(false);
        return;
      }

      router.push("/admin/recepturen");
      router.refresh();
    } catch (error) {
      console.error(error);
      setError("Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="max-w-5xl mx-auto p-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500">
          Recept laden...
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-5xl mx-auto p-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Admin
          </p>
          <h1 className="text-3xl font-bold text-slate-900">Recept bewerken</h1>
          <p className="mt-2 text-slate-600">
            Pas een bestaande keukenreceptuur aan.
          </p>
        </div>

        <Link
          href="/admin/recepturen"
          className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
        >
          ← Terug naar overzicht
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Basisgegevens</h2>

          <div className="mt-5 grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Naam
              </label>
              <input
                value={naam}
                onChange={(e) => setNaam(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-pink-500"
                placeholder="Bijv. Amarena"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Categorie
              </label>
              <select
                value={categorie}
                onChange={(e) => setCategorie(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-pink-500"
              >
                {categorieen.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Hoeveelheid mix
              </label>
              <input
                value={hoeveelheidMix}
                onChange={(e) => setHoeveelheidMix(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-pink-500"
                placeholder="Bijv. 5 liter"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Maakvolgorde
              </label>

              <input
                type="number"
                value={maakvolgorde}
                onChange={(e) => setMaakvolgorde(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-pink-500"
              />

              <p className="mt-1 text-xs text-slate-500">
                Lager = eerder maken (bijv. yoghurt 10, snickers 90)
              </p>
            </div>

            <div className="flex items-end">
              <label className="inline-flex items-center gap-3 rounded-xl border border-slate-200 px-4 py-3">
                <input
                  type="checkbox"
                  checked={actief}
                  onChange={(e) => setActief(e.target.checked)}
                />
                <span className="text-sm font-medium text-slate-700">
                  Actief
                </span>
              </label>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Werkwijze – voorbereiden
              </label>
              <textarea
                value={voorbereiding}
                onChange={(e) => setVoorbereiding(e.target.value)}
                rows={8}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-pink-500"
                placeholder={`1. Base afwegen
2. Pasta toevoegen
3. Goed mixen
4. Brix meten`}
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-medium text-slate-700">
                Werkwijze – draaien
              </label>
              <textarea
                value={draaien}
                onChange={(e) => setDraaien(e.target.value)}
                rows={6}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-pink-500"
                placeholder={`1. Emulgator toevoegen op -7
2. Uittappen op -9`}
              />
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-xl font-semibold text-slate-900">
              Benodigdheden
            </h2>

            <button
              type="button"
              onClick={addIngredient}
              className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-200"
            >
              + Regel toevoegen
            </button>
          </div>

          <div className="mt-5 space-y-3">
            {ingredienten.map((ing, index) => (
              <div
                key={index}
                className="grid gap-3 rounded-xl border border-slate-200 p-4 md:grid-cols-[1fr_180px_auto]"
              >
                <input
                  value={ing.naam}
                  onChange={(e) =>
                    updateIngredient(index, "naam", e.target.value)
                  }
                  className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-pink-500"
                  placeholder="Benodigdheid"
                />

                <input
                  value={ing.gewicht}
                  onChange={(e) =>
                    updateIngredient(index, "gewicht", e.target.value)
                  }
                  className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-pink-500"
                  placeholder="Gewicht"
                />

                <button
                  type="button"
                  onClick={() => removeIngredient(index)}
                  disabled={ingredienten.length === 1}
                  className="rounded-lg border border-slate-300 px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                >
                  Verwijderen
                </button>
              </div>
            ))}
          </div>
        </div>

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-pink-600 px-5 py-3 text-sm font-medium text-white shadow hover:bg-pink-700 disabled:opacity-60"
          >
            {saving ? "Opslaan..." : "Wijzigingen opslaan"}
          </button>

          <Link
            href="/admin/recepturen"
            className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Annuleren
          </Link>
        </div>
      </form>
    </main>
  );
}