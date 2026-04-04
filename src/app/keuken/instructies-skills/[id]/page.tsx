import Link from "next/link";

export default function InstructieDetailPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/keuken/instructies-skills"
          className="mb-6 inline-flex items-center text-slate-600"
        >
          ← Terug
        </Link>

        <h1 className="text-3xl font-bold text-slate-900">
          Instructie
        </h1>

        <div className="mt-6 rounded-3xl bg-white p-6 shadow-sm">
          <p>Hier komt de instructie...</p>
        </div>
      </div>
    </main>
  );
}