"use client";

import * as React from 'react';
import {
  User,
  Users,
  Tag,
  FileText,
  Folder,
  Eye,
  BarChart2,
  CheckSquare,
  IceCream,
  Wrench,
  CalendarDays,
  Clock,
  Activity,
  Box,
  ShoppingCart,
  Layers,
  CreditCard,
  Archive
} from 'lucide-react';

const Section = ({ title, children, color }: { title: string; children: React.ReactNode; color?: string }) => (
  <section className="mb-10">
    <div
      className={`rounded-xl px-6 py-3 mb-4 shadow-inner ${
        bgColorMap[color || ''] || 'bg-gray-100 text-gray-900 hover:bg-gray-200'
      }`}
    >
      <h2 className="text-xl font-semibold text-gray-800 tracking-tight">{title}</h2>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">{children}</div>
  </section>
);

const bgColorMap: Record<string, string> = {
  green: 'bg-green-100 text-green-900 hover:bg-green-200',
  pink: 'bg-pink-100 text-pink-900 hover:bg-pink-200',
  purple: 'bg-purple-100 text-purple-900 hover:bg-purple-200',
  blue: 'bg-sky-100 text-sky-900 hover:bg-sky-200',
  red: 'bg-rose-100 text-rose-900 hover:bg-rose-200',
  slate: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
  orange: 'bg-orange-100 text-orange-900 hover:bg-orange-200',
  gray: 'bg-gray-100 text-gray-900 hover:bg-gray-200'
};

type LinkCardProps = {
  href: string;
  label: string;
  color: string;
  Icon: (props: React.SVGProps<SVGSVGElement>) => JSX.Element;
};

const LinkCard = ({ href, label, color, Icon }: LinkCardProps) => (
  <Link
    href={href}
    className={`flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium shadow transition ${
      bgColorMap[color] || 'bg-gray-200 text-gray-900'
    }`}
  >
    <Icon className="mr-2 h-5 w-5" />
    {label}
  </Link>
);

export default function AdminDashboard() {
  return (
    <main className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-8 text-slate-800">🗂️ Management Portaal</h1>

      <Section title="👥 Medewerkers en instructies" color="green">
        <LinkCard href="/admin/medewerkers" label="Medewerkers beheren" color="green" Icon={User} />
        <LinkCard
          href="/admin/medewerkers/overzicht"
          label="Gegevens medewerkers"
          color="green"
          Icon={Users}
        />
        <LinkCard href="/sollicitatie/pdf" label="Sollicitatiemails" color="green" Icon={FileText} />
        <LinkCard href="/admin/functies" label="Functies" color="green" Icon={Tag} />
        <LinkCard href="/admin/dossier" label="Dossiers" color="green" Icon={Folder} />
        <LinkCard
          href="/admin/instructies"
          label="Instructies beheren"
          color="green"
          Icon={FileText}
        />
        <LinkCard href="/instructies" label="Instructies medewerkers" color="green" Icon={Eye} />
        <LinkCard
          href="/admin/resultaten"
          label="Toetsresultaten"
          color="green"
          Icon={BarChart2}
        />
      </Section>

      <Section title="📘 Management" color="blue">
        <LinkCard href="/admin/acties" label="Actielijsten" color="blue" Icon={CheckSquare} />
        <LinkCard href="/admin/suikervrij" label="Suikervrij productie" color="blue" Icon={IceCream} />
        <LinkCard
          href="/admin/schoonmaakroutines"
          label="Schoonmaakroutines"
          color="blue"
          Icon={Wrench}
        />
      </Section>

      <Section title="🧠 Skills" color="purple">
        <LinkCard
          href="/admin/skills/categorieen"
          label="Beheer categorieën"
          color="purple"
          Icon={Tag}
        />
        <LinkCard href="/admin/skills" label="Skills beheer" color="purple" Icon={Layers} />
        <LinkCard
          href="/admin/skills/toewijzen"
          label="Skills toewijzen"
          color="purple"
          Icon={Activity}
        />
        <LinkCard href="/skills" label="Skills medewerkers" color="purple" Icon={Layers} />
      </Section>

      <Section title="📅 Planning" color="slate">
        <LinkCard href="/open-diensten" label="Open Shifts" color="orange" Icon={CalendarDays} />
        <LinkCard
          href="/admin/rapportages/timesheets"
          label="Klokuren"
          color="orange"
          Icon={Clock}
        />
        <LinkCard
          href="/shift-acties"
          label="Shiftacties & Statistieken"
          color="orange"
          Icon={Activity}
        />
      </Section>

      <Section title="📦 Voorraadbeheer" color="pink">
        <LinkCard
          href="/admin/voorraad/artikelen"
          label="Artikelen beheren"
          color="pink"
          Icon={Box}
        />
        <LinkCard
          href="/admin/voorraad/bestelpagina"
          label="Bestel-app"
          color="pink"
          Icon={ShoppingCart}
        />
      </Section>

      <Section title="📊 Rapportages" color="slate">
        <LinkCard
          href="/admin/rapportages"
          label="Omzet & voorraad"
          color="gray"
          Icon={CreditCard}
        />
        <LinkCard
          href="/admin/rapportages/medewerkers/overzicht-progressie"
          label="Medewerkers-voortgang"
          color="gray"
          Icon={BarChart2}
        />
        <LinkCard
          href="/admin/rapportage/omzet"
          label="Inlezen omzet"
          color="gray"
          Icon={FileText}
        />
        <LinkCard
          href="/admin/rapportage"
          label="Rapporten"
          color="gray"
          Icon={Archive}
        />
      </Section>
    </main>
  );
}
