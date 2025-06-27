//src/app/admin/page.tsx

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

const LinkCard = ({ href, label, color }: { href: string; label: string; color: string }) => (
  <Link
    href={href}
    className={`rounded-lg px-4 py-3 text-white text-center font-medium shadow hover:brightness-110 bg-${color}-600`}
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
        <LinkCard href="/admin/instructies" label="Instructies beheren" color="blue" />
        <LinkCard href="/admin/toetsresultaten" label="Toetsresultaten" color="purple" />
        <LinkCard href="/instructies" label="Instructies voor medewerkers" color="gray" />
        <LinkCard href="/admin/sollicitaties" label="Sollicitatiemails" color="red" />
        <LinkCard href="/admin/skills" label="Skills Overzicht" color="yellow" />
      </Section>

      <Section title="📅 Planning">
        <LinkCard href="/admin/planning/open-shifts" label="Open Shifts PDF" color="cyan" />
        <LinkCard href="/admin/planning/shiftacties" label="Shiftacties & Statistieken" color="pink" />
      </Section>

      <Section title="📦 Voorraadbeheer">
        <LinkCard href="/admin/voorraad/artikelen" label="Artikelen beheren" color="orange" />
        <LinkCard href="/admin/voorraad/bestellen" label="Bestel-app" color="amber" />
      </Section>

      <Section title="📊 Rapportages (binnenkort)">
        <LinkCard href="/admin/rapportages" label="Omzet & voorraad" color="zinc" />
      </Section>
    </main>
  );
}
