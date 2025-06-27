'use client';

import Link from 'next/link';
import { clsx } from 'clsx';

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

const LinkCard = ({
  href,
  label,
  color,
}: {
  href: string;
  label: string;
  color: 'blue' | 'green' | 'slate' | 'cyan' | 'fuchsia' | 'yellow' | 'red' | 'pink';
}) => {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-500 hover:bg-blue-600',
    green: 'bg-green-500 hover:bg-green-600',
    slate: 'bg-slate-700 hover:bg-slate-800',
    cyan: 'bg-cyan-600 hover:bg-cyan-700',
    fuchsia: 'bg-fuchsia-600 hover:bg-fuchsia-700',
    yellow: 'bg-yellow-400 hover:bg-yellow-500',
    red: 'bg-red-600 hover:bg-red-700',
    pink: 'bg-pink-500 hover:bg-pink-600',
  };

  return (
    <Link
      href={href}
      className={clsx(
        'rounded-lg px-6 py-4 text-white text-center font-semibold text-sm shadow transition duration-200',
        colorClasses[color]
      )}
    >
      {label}
    </Link>
  );
};

export default function AdminDashboard() {
  return (
    <main className="max-w-5xl mx-auto p-6 space-y-12">
      <h1 className="text-3xl font-bold mb-4 flex items-center gap-2">
        🗂️ Management Portaal
      </h1>

      <Section title="👥 Personeel">
        <LinkCard href="/admin/instructies" label="Instructies beheren" color="blue" />
        <LinkCard href="/admin/medewerkers" label="Medewerkers beheren" color="green" />
        <LinkCard href="/instructies" label="Instructies voor medewerkers" color="slate" />
        <LinkCard href="/admin/resultaten" label="Toetsresultaten" color="fuchsia" />
        <LinkCard href="/sollicitatie/pdf" label="Sollicitatiemails" color="red" />
        <LinkCard href="/admin/skills" label="Skills Overzicht" color="yellow" />
      </Section>

      <Section title="📅 Planning">
        <LinkCard href="/openshifts" label="Open Shifts PDF" color="cyan" />
        <LinkCard href="/shift-acties" label="Shiftacties & Statistieken" color="pink" />
      </Section>

      <Section title="📦 Voorraadbeheer">
        <LinkCard href="/admin/voorraad/artikelen" label="Artikelen beheren" color="green" />
        <LinkCard href="/admin/voorraad/bestellen" label="Bestel-app" color="pink" />
      </Section>

      <Section title="📊 Rapportages (binnenkort)">
        <LinkCard href="/admin/rapportages" label="Omzet & voorraad" color="blue" />
      </Section>
    </main>
  );
}
