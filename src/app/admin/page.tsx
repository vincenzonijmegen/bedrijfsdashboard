// src/components/AdminDashboard.tsx
"use client";

import * as React from 'react';
import Link from 'next/link';
import useSWR from 'swr';

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
  Archive,
  ChevronDown,
  ChevronRight,
  PieChart,
  List,
  ClipboardList,
  Truck
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

const bgColorMap: Record<string, string> = {
  green: 'bg-green-100 text-green-900 hover:bg-green-200',
  pink: 'bg-pink-100 text-pink-900 hover:bg-pink-200',
  purple: 'bg-purple-100 text-purple-900 hover:bg-purple-200',
  blue: 'bg-sky-100 text-sky-900 hover:bg-sky-200',
  red: 'bg-rose-100 text-rose-900 hover:bg-rose-200',
  slate: 'bg-slate-100 text-slate-900 hover:bg-slate-200',
  orange: 'bg-orange-100 text-orange-900 hover:bg-orange-200',
  gray: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
  yellow: 'bg-yellow-100 text-yellow-900 hover:bg-yellow-200',
  amber:  'bg-amber-100  text-amber-900  hover:bg-amber-200',
  teal:   'bg-teal-100   text-teal-900   hover:bg-teal-200',
  indigo: 'bg-indigo-100 text-indigo-900 hover:bg-indigo-200',
  emerald:'bg-emerald-100 text-emerald-900 hover:bg-emerald-200'
};

type LinkCardProps = {
  href: string;
  label: string;
  color: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
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

type SectionProps = {
  id: string;
  title: string;
  children: React.ReactNode;
  color?: string;
  activeSection: string;
  setActiveSection: (id: string) => void;
};

const Section = ({ id, title, children, color, activeSection, setActiveSection }: SectionProps) => {
  const open = id === activeSection;
  return (
    <section className="mb-6 border rounded-xl overflow-hidden shadow-sm">
      <button
        onClick={() => setActiveSection(open ? '' : id)}
        className={`w-full flex items-center justify-between px-6 py-3 font-semibold tracking-tight transition ${
          bgColorMap[color || ''] || 'bg-gray-100 text-gray-900 hover:bg-gray-200'
        }`}
      >
        <span>{title}</span>
        {open ? <ChevronDown className="w-5 h-5 opacity-70" /> : <ChevronRight className="w-5 h-5 opacity-70" />}
      </button>
      {open && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-white">
          {children}
        </div>
      )}
    </section>
  );
};

function DailyTotalDisplay() {
  const today = new Date().toISOString().slice(0, 10).split('-').reverse().join('-');
  const { data } = useSWR('/api/kassa/omzet?start=' + today + '&totalen=1', fetcher);
  const record = Array.isArray(data) ? data[0] : null;
  const cash = record ? parseFloat(record.Cash) || 0 : 0;
  const pin = record ? parseFloat(record.Pin) || 0 : 0;
  const bon = record ? parseFloat(record.Bon) || 0 : 0;
  const total = cash + pin + bon;
  return <span className="text-lg font-semibold">€ {total.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>;
}

export default function AdminDashboard() {
  // activeSection state persisted in localStorage
  const [activeSection, setActive] = React.useState<string>(() => {
    if (typeof window === 'undefined') return 'meest';
    return localStorage.getItem('activeSection') || 'meest';
  });

  const setActiveSection = (id: string) => {
    setActive(id);
    localStorage.setItem('activeSection', id);
  };

  return (
    <main className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-slate-800">🗂️ Portaal Vincenzo</h1>
        <Link href="/admin/dashboard" className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">
          <DailyTotalDisplay />
        </Link>
      </div>

      <Section id="meest" title="👥 Meest gebruikte onderdelen" color="slate" activeSection={activeSection} setActiveSection={setActiveSection}>
        <LinkCard href="/admin/voorraad/bestelpagina" label="Bestel-app" color="slate" Icon={ShoppingCart} />
        <LinkCard href="/admin/shiftbase/rooster" label="Rooster per dag" color="slate" Icon={CalendarDays} />
        <LinkCard href="/open-diensten" label="Open Shifts" color="slate" Icon={CalendarDays} />
        <LinkCard href="/admin/dossier" label="Dossiers" color="slate" Icon={Folder} />
        <LinkCard href="/admin/acties" label="Actielijsten" color="slate" Icon={CheckSquare} />
        <LinkCard href="/admin/notities" label="Notities" color="slate" Icon={FileText} />
        <LinkCard href="/admin/schoonmaakroutines" label="Schoonmaakroutines" color="slate" Icon={Wrench} />
        <LinkCard href="/admin/rapportage/financieel" label="Financiële Rapporten" color="slate" Icon={BarChart2} />
      </Section>

      <Section id="management" title="📘 Management" color="blue" activeSection={activeSection} setActiveSection={setActiveSection}>
        <LinkCard href="/admin/acties" label="Actielijsten" color="blue" Icon={CheckSquare} />
        <LinkCard href="/admin/notities" label="Notities" color="blue" Icon={FileText} />
        <LinkCard href="/admin/schoonmaakroutines" label="Schoonmaakroutines" color="blue" Icon={Wrench} />
        <LinkCard href="/admin/contacten" label="Belangrijke gegevens" color="blue" Icon={Folder} />
      </Section>

      <Section id="planning" title="📅 Planning" color="orange" activeSection={activeSection} setActiveSection={setActiveSection}>
        <LinkCard href="/admin/shiftbase/rooster" label="Rooster per dag" color="orange" Icon={CalendarDays} />
        <LinkCard href="/open-diensten" label="Open Shifts" color="orange" Icon={CalendarDays} />
        <LinkCard href="/admin/rapportages/timesheets" label="Klokuren" color="orange" Icon={Clock} />
        <LinkCard href="/shift-acties" label="Shiftacties & Statistieken" color="orange" Icon={Activity} />
      </Section>

      <Section id="rapportages" title="📊 Rapportages" color="amber" activeSection={activeSection} setActiveSection={setActiveSection}>
        <LinkCard href="/admin/rapportage/financieel" label="Financiële Rapporten" color="amber" Icon={BarChart2} />
        <LinkCard href="/admin/rapportage/medewerkers" label="Medewerkers Rapporten" color="amber" Icon={BarChart2} />
      </Section>

      <Section id="medewerkers" title="👥 Medewerkers en instructies" color="green" activeSection={activeSection} setActiveSection={setActiveSection}>
        <LinkCard href="/admin/medewerkers" label="Medewerkers beheren" color="green" Icon={User} />
        <LinkCard href="/admin/medewerkers/overzicht" label="Gegevens medewerkers" color="green" Icon={Users} />
        <LinkCard href="/sollicitatie/pdf" label="Sollicitatiemails" color="green" Icon={FileText} />
        <LinkCard href="/admin/functies" label="Functies" color="green" Icon={Tag} />
        <LinkCard href="/admin/dossier" label="Dossiers" color="green" Icon={Folder} />
        <LinkCard href="/admin/instructies" label="Instructies beheren" color="green" Icon={FileText} />
        <LinkCard href="/instructies" label="Instructies medewerkers" color="green" Icon={Eye} />
      </Section>

      <Section id="skills" title="🧠 Skills" color="purple" activeSection={activeSection} setActiveSection={setActiveSection}>
        <LinkCard href="/admin/skills/categorieen" label="Beheer categorieën" color="purple" Icon={Tag} />
        <LinkCard href="/admin/skills" label="Skills beheer" color="purple" Icon={Layers} />
        <LinkCard href="/admin/skills/toewijzen" label="Skills toewijzen" color="purple" Icon={Activity} />
        <LinkCard href="/skills" label="Skills medewerkers" color="purple" Icon={Layers} />
      </Section>

      <Section id="voorraad" title="📦 Voorraadbeheer, Recepturen & Allergenen" color="pink" activeSection={activeSection} setActiveSection={setActiveSection}>
        <LinkCard href="/admin/leveranciers" label="Leveranciers beheren" color="pink" Icon={CreditCard} />
        <LinkCard href="/admin/suikervrij" label="Suikervrij productie" color="pink" Icon={IceCream} />
        <LinkCard href="/admin/voorraad/artikelen" label="Artikelen beheren" color="pink" Icon={Box} />
        <LinkCard href="/admin/voorraad/bestelpagina" label="Bestel-app" color="pink" Icon={ClipboardList} />
        <LinkCard href="/admin/recepten" label="Receptprijs" color="pink" Icon={Truck} />
        <LinkCard href="/admin/producten/allergenen" label="Allergenenregistratie" color="pink" Icon={List} />
        <LinkCard href="/admin/recepten/allergenen" label="Allergenenkaart" color="pink" Icon={List} />
      </Section>

      <Section id="import" title="📊 Import" color="teal" activeSection={activeSection} setActiveSection={setActiveSection}>
        <LinkCard href="/admin/kassa-omzet" label="Omzet inlezen" color="teal" Icon={Wrench} />
        <LinkCard href="/admin/mypos" label="Inlezen myPOS (maand)" color="teal" Icon={Archive} />
        <LinkCard href="/admin/aftekenlijsten/upload" label="Upload HACCP-formulieren" color="teal" Icon={Archive} />
      </Section>
    </main>
  );
}
