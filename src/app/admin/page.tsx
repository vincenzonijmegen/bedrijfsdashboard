"use client";

import Link from "next/link";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-8">
    <h2 className="text-xl font-semibold mb-4">{title}</h2>
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {children}
    </div>
  </section>
);

const bgColorMap: Record<string, string> = {
  green: "bg-green-600 hover:bg-green-700",
  pink: "bg-pink-600 hover:bg-pink-700",
  purple: "bg-purple-600 hover:bg-purple-700",
  blue: "bg-blue-600 hover:bg-blue-700",
  red: "bg-red-600 hover:bg-red-700",
  slate: "bg-slate-600 hover:bg-slate-700",
};

const LinkCard = ({ href, label, color }: { href: string; label: string; color: string }) => (
  <Link
    href={href}
    className={`block rounded-lg px-4 py-3 text-white text-center font-medium shadow transition ${bgColorMap[color] || "bg-gray-500"}`}
  >
    {label}
  </Link>
);

export default function AdminDashboard() {
  return (
    <main className="max-w-6xl mx-auto p-6">
      <h1 className="text-3xl font-bold mb-8">🗂️ Management Portaal</h1>

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
