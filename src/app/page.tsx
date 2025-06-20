// app/page.tsx

import Link from "next/link";

export default function Home() {
  return (
    <main className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">📋 Management Portaal</h1>
      <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3">
        <Link href="/admin/instructies" className="block bg-blue-600 text-white p-6 rounded-xl shadow hover:bg-blue-700">
          Instructies beheren
        </Link>
        <Link href="/admin/medewerkers" className="block bg-green-600 text-white p-6 rounded-xl shadow hover:bg-green-700">
          Medewerkers beheren
        </Link>
        <Link href="/instructies" className="block bg-gray-700 text-white p-6 rounded-xl shadow hover:bg-gray-800">
          Instructies voor medewerkers
        </Link>
        <Link href="/open-shifts" className="block bg-cyan-600 text-white p-6 rounded-xl shadow hover:bg-cyan-700">
          Open Shifts PDF
        </Link>
        <Link href="/admin/resultaten" className="block bg-purple-600 text-white p-6 rounded-xl shadow hover:bg-purple-700">
          Toetsresultaten
        </Link>
        <Link href="/admin/skills" className="block bg-yellow-500 text-white p-6 rounded-xl shadow hover:bg-yellow-600">
          Skills Overzicht
        </Link>
        <Link href="/shift-acties" className="block bg-pink-600 text-white p-6 rounded-xl shadow hover:bg-pink-700">
          Shiftacties & Statistieken
        </Link>
      </div>
    </main>
  );
}
