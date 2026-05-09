"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, Save } from "lucide-react";

export default function NieuwInfotheekArtikelPage() {
  const router = useRouter();

  const [titel, setTitel] = useState("");
  const [categorie, setCategorie] = useState("");
  const [samenvatting, setSamenvatting] = useState("");
  const [inhoud, setInhoud] = useState("");
  const [zoekwoordenInput, setZoekwoordenInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);

    try {
      const zoekwoorden = zoekwoordenInput
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);

      const res = await fetch("/api/infotheek", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          titel,
          categorie,
          samenvatting,
          inhoud,
          zoekwoorden,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Opslaan mislukt");
      }

      router.push(`/admin/infotheek/${data.slug}`);
    } catch (err: any) {
      setError(err.message || "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href="/admin/infotheek"
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Terug naar Infotheek
        </Link>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-6 border-b border-slate-200 pb-5">
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              Nieuw artikel
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Maak een nieuwe handleiding voor de Infotheek.
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Titel
              </label>
              <input
                value={titel}
                onChange={(e) => setTitel(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="Bijvoorbeeld: Nieuwe medewerker aannemen"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Categorie
              </label>
              <input
                value={categorie}
                onChange={(e) => setCategorie(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="Bijvoorbeeld: Medewerkers"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Samenvatting
              </label>
              <textarea
                value={samenvatting}
                onChange={(e) => setSamenvatting(e.target.value)}
                className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="Korte uitleg die op de overzichtspagina zichtbaar is."
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Inhoud
              </label>
              <textarea
                value={inhoud}
                onChange={(e) => setInhoud(e.target.value)}
                className="min-h-[360px] w-full rounded-xl border border-slate-200 bg-white px-4 py-3 font-mono text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder={`<h2>Doel</h2>
<p>Leg hier uit waar dit onderdeel voor bedoeld is.</p>

<h2>Stap voor stap</h2>
<ul>
  <li>Stap 1...</li>
  <li>Stap 2...</li>
</ul>

<h2>Veelgemaakte fouten</h2>
<p>Beschrijf waar je op moet letten.</p>`}
                required
              />
              <p className="mt-2 text-xs text-slate-500">
                Gebruik HTML met h2/h3-koppen. Die verschijnen automatisch in de inhoudsopgave.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Zoekwoorden
              </label>
              <input
                value={zoekwoordenInput}
                onChange={(e) => setZoekwoordenInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="Bijvoorbeeld: medewerker, sollicitatie, onboarding"
              />
              <p className="mt-2 text-xs text-slate-500">
                Scheid zoekwoorden met komma’s.
              </p>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3 border-t border-slate-200 pt-5">
            <Link
              href="/admin/infotheek"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Annuleren
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? "Opslaan..." : "Artikel opslaan"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}