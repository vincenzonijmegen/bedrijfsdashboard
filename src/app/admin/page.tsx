'use client';

import Link from 'next/link';

const Section = ({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) => (
  <section className="mb-10">
    <h2 className="text-xl font-semibold mb-4">{title}</h2>
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {children}
    </div>
  </section>
);

export default function AdminDashboard() {
  return (
    <main className="max-w-5xl mx-auto p-6 space-y-12">
      <h1 className="text-3xl font-bold mb-8 flex items-center gap-2">
        🗂️ Management Portaal
      </h1>

      <Section title="👥 Personeel">
        <Link href="/admin/instructies" className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-6 py-4 text-center font-semibold text-sm shadow transition duration-200">Instructies beheren</Link>
        <Link href="/admin/medewerkers" className="bg-green-500 hover:bg-green-600 text-white rounded-lg px-6 py-4 text-center font-semibold text-sm shadow transition duration-200">Medewerkers beheren</Link>
        <Link href="/instructies" className="bg-slate-700 hover:bg-slate-800 text-white rounded-lg px-6 py-4 text-center font-semibold text-sm shadow transition duration-200">Instructies voor medewerkers</Link>
        <Link href="/admin/resultaten" className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg px-6 py-4 text-center font-semibold text-sm shadow transition duration-200">Toetsresultaten</Link>
        <Link href="/sollicitatie/pdf" className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-6 py-4 text-center font-semibold text-sm shadow transition duration-200">Sollicitatiemails</Link>
        <Link href="/admin/skills" className="bg-yellow-400 hover:bg-yellow-500 text-white rounded-lg px-6 py-4 text-center font-semibold text-sm shadow transition duration-200">Skills Overzicht</Link>
      </Section>

      <Section title="📅 Planning">
        <Link href="/openshifts" className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg px-6 py-4 text-center font-semibold text-sm shadow transition duration-200">Open Shifts PDF</Link>
        <Link href="/shift-acties" className="bg-pink-500 hover:bg-pink-600 text-white rounded-lg px-6 py-4 text-center font-semibold text-sm shadow transition duration-200">Shiftacties & Statistieken</Link>
      </Section>

      <Section title="📦 Voorraadbeheer">
        <Link href="/admin/voorraad/artikelen" className="bg-green-500 hover:bg-green-600 text-white rounded-lg px-6 py-4 text-center font-semibold text-sm shadow transition duration-200">Artikelen beheren</Link>
        <Link href="/admin/voorraad/bestellen" className="bg-pink-500 hover:bg-pink-600 text-white rounded-lg px-6 py-4 text-center font-semibold text-sm shadow transition duration-200">Bestel-app</Link>
      </Section>

      <Section title="📊 Rapportages (binnenkort)">
        <Link href="/admin/rapportages" className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg px-6 py-4 text-center font-semibold text-sm shadow transition duration-200">Omzet & voorraad</Link>
      </Section>
    </main>
  );
}
