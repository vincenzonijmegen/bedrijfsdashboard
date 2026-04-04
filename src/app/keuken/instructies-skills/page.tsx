import Link from "next/link";

export default function KeukenInstructiesPage() {
  const instructies = [
    { id: 1, titel: "IJs draaien" },
    { id: 2, titel: "Bak vullen" },
    { id: 3, titel: "Machine schoonmaken" },
  ];

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <Link
          href="/keuken"
          className="mb-6 inline-flex items-center text-slate-600"
        >
          ← Terug
        </Link>

        <h1 className="text-3xl font-bold text-slate-900">
          Werkinstructies & Skills
        </h1>

        <p className="mt-2 text-slate-600">
          Open instructies voor de keuken.
        </p>

        {/* 👇 HIER KOMT STAP 4 */}
        <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {instructies.map((item) => (
            <Link
              key={item.id}
              href={`/keuken/instructies-skills/${item.id}`}
              className="flex h-[96px] items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center shadow-sm"
            >
              <span className="block max-w-[170px] text-lg font-semibold leading-snug text-slate-900">
                {item.titel}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}