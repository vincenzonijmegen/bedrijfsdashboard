import Link from "next/link";

const categorieen = [
  { slug: "melksmaken", titel: "Melksmaken" },
  { slug: "vruchtensmaken", titel: "Vruchtensmaken" },
  { slug: "suikervrij", titel: "Suikervrij" },
  { slug: "sauzen", titel: "Sauzen" },
  { slug: "mixen", titel: "Mixen" }
];

export default function RecepturenPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <Link href="/keuken" className="mb-6 inline-block text-slate-600">
          ← Terug
        </Link>

        <h1 className="text-3xl font-bold text-slate-900">
          Recepturen
        </h1>

        <p className="mt-2 text-slate-600">
          Kies een categorie.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {categorieen.map((cat) => (
            <Link
              key={cat.slug}
              href={`/keuken/recepturen/${cat.slug}`}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h2 className="text-2xl font-semibold text-slate-900">
                {cat.titel}
              </h2>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}