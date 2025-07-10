"use client";

import Link from "next/link";

const Section = ({ title, children, color }: { title: string; children: React.ReactNode; color?: string }) => (
  <section className="mb-10">
    <div className={`rounded-xl px-6 py-3 mb-4 shadow-inner ${bgColorMap[color || ''] || 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}>
      <h2 className="text-xl font-semibold text-gray-800 tracking-tight">{title}</h2>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
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
    className={`block rounded-lg px-3 py-2 text-center text-sm font-medium shadow transition ${bgColorMap[color] || "bg-gray-200 text-gray-900"}`}
  >
    {label}
  </Link>
);

export default function AdminDashboard() {
  return (
    <main className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-8 text-slate-800">🗂️ Management Portaal</h1>

      <Section title="👥 Medewerkers" color="green">
        <LinkCard href="/admin/medewerkers" label="👤 Medewerkers beheren" color="green" />
        <LinkCard href="/admin/medewerkers/overzicht" label="👤 Gegevens medewerkers" color="green" />
        <LinkCard href="/sollicitatie/pdf" label="📥 Sollicitatiemails" color="green" />
        <LinkCard href="/admin/dossier" label="Dossiers" color="green" />
      </Section>

      <Section title="📘 Instructies" color="blue">
        <LinkCard href="/admin/instructies" label="📝 Instructies beheren" color="blue" />
        <LinkCard href="/instructies" label="👓 Instructies medewerkers" color="blue" />
        <LinkCard href="/admin/resultaten" label="📊 Toetsresultaten" color="blue" />
      </Section>

      <Section title="🧠 Skills" color="purple">
        <LinkCard href="/admin/skills/categorieen" label="👥 Beheer categorieën" color="purple" />
        <LinkCard href="/admin/skills" label="🧩 Skills beheer" color="purple" />
        <LinkCard href="/admin/skills/toewijzen" label="👥 Skills toewijzen" color="purple" />
        <LinkCard href="/skills" label="🧩 Skills medewerkers" color="purple" />
      </Section>

      <Section title="📅 Planning" color="slate">
        <LinkCard href="/open-diensten" label="📄 Open Shifts" color="orange" />
        <LinkCard href="/admin/rapportages/timesheets" label="📄 Klokuren" color="orange" />
        <LinkCard href="/shift-acties" label="📈 Shiftacties & Statistieken" color="orange" />
      </Section>

      <Section title="📦 Voorraadbeheer" color="pink">
        <LinkCard href="/admin/voorraad/artikelen" label="📋 Artikelen beheren" color="pink" />
        <LinkCard href="/admin/voorraad/bestelpagina" label="🛒 Bestel-app" color="pink" />
      </Section>

      <Section title="📊 Rapportages" color="slate">
        <LinkCard href="/admin/rapportages" label="📈 Omzet & voorraad" color="gray" />
        <LinkCard href="/admin/rapportages/medewerkers/overzicht-progressie" label="📈 Medewerkers-voortgang" color="gray" />
      </Section>
    </main>
  );
}

