// pages/index.tsx

import Link from "next/link";

export default function Home() {
  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">📋 Management Portaal</h1>
      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
        <Link href="/admin" className="block bg-blue-600 text-white p-6 rounded-xl shadow hover:bg-blue-700">
          Beheerscherm
        </Link>
        <Link href="/instructies" className="block bg-gray-700 text-white p-6 rounded-xl shadow hover:bg-gray-800">
          Instructies voor medewerkers
        </Link>
        <Link href="/open-shifts" className="block bg-cyan-600 text-white p-6 rounded-xl shadow hover:bg-cyan-700">
          Open Shifts PDF
        </Link>
        <Link href="/resultaten" className="block bg-purple-600 text-white p-6 rounded-xl shadow hover:bg-purple-700">
          Toetsresultaten
        </Link>
        <Link href="/skills" className="block bg-yellow-500 text-white p-6 rounded-xl shadow hover:bg-yellow-600">
          Skills Overzicht
        </Link>
        {/* Voeg hier toekomstige modules toe */}
      </div>
    </main>
  );
}
