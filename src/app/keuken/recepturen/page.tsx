import Link from "next/link";

type Categorie = {
  slug: string;
  naam: string;
};

async function getCategorieen(): Promise<Categorie[]> {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const res = await fetch(`${baseUrl}/api/keuken/categorieen`, {
    cache: "no-store",
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.error || "Fout bij ophalen categorieën");
  }

  return data.items;
}

export default async function RecepturenPage() {
  const categorieen = await getCategorieen();

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <Link href="/keuken" className="mb-6 inline-block text-slate-600">
          ← Terug
        </Link>

        <h1 className="text-3xl font-bold text-slate-900">Recepturen</h1>
        <p className="mt-2 text-slate-600">Kies een categorie.</p>

        {categorieen.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-slate-500">
            Nog geen categorieën gevonden.
          </div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {categorieen.map((cat) => (
              <Link
                key={cat.slug}
                href={`/keuken/recepturen/${cat.slug}`}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <h2 className="text-2xl font-semibold text-slate-900">
                  {cat.naam}
                </h2>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}