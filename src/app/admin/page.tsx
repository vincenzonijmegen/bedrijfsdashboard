"use client";

import Link from "next/link";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-12">
    <div className="bg-gray-100 rounded-xl px-6 py-4 mb-6 shadow-inner">
      <h2 className="text-2xl font-bold text-gray-800 tracking-tight">{title}</h2>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {children}
    </div>
  </section>
);

const bgColorMap: Record<string, string> = {
  green: "bg-green-100 text-green-900 hover:bg-green-200",
  pink: "bg-pink-100 text-pink-900 hover:bg-pink-200",
  purple: "bg-purple-100 text-purple-900 hover:bg-purple-200",
  blue: "bg-sky-100 text-sky-900 hover:bg-sky-200",
  red: "bg-rose-100 text-rose-900 hover:bg-rose-200",
  slate: "bg-slate-100 text-slate-900 hover:bg-slate-200",
};

const LinkCard = ({ href, label, color }: { href: string; label: string; color: string }) => (
  <Link
    href={href}
    className={`block rounded-lg px-4 py-3 text-center font-medium shadow transition ${bgColorMap[color] || "bg-gray-200 text-gray-900"}`}
  >
    {label}
  </Link>
);

export default function AdminDashboard() {
  return (
    <main className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-10 text-slate-800">🗂️ Management Portaal</h1>

      <Section title="👥 Personeel">
        <LinkCard href="/admin/medewerkers" label="Medewerkers beheren" color="green" />
        <LinkCard href="/admin/instructies" label="Instructies beheren" color="pink" />
        <LinkCard href="/admin/resultaten" label="toetsresultaten" color="purple" />
        <LinkCard href="/instructies" label="Instructies medewerkers" color="blue" />
        <LinkCard href="/sollicitatie/pdf" label="Sollicitatiemails" color="red" />
        <LinkCard href="/admin/skills" label="Skills Overzicht" color="slate" />
      </Section>

      <Section title="📅 Planning">
        <LinkCard href="/openshifts" label="Open Shifts PDF" color="green" />
        <LinkCard href="/shift-acties" label="Shiftacties & Statistieken" color="pink" />
      </Section>

      <Section title="📦 Voorraadbeheer">
        <LinkCard href="/admin/voorraad/artikelen" label="Artikelen beheren" color="green" />
        <LinkCard href="/admin/voorraad/bestellen" label="Bestel-app" color="pink" />
      </Section>

      <Section title="📊 Rapportages (binnenkort)">
        <LinkCard href="/admin/rapportages" label="Omzet & voorraad" color="green" />
      </Section>
    </main>
  );
}
