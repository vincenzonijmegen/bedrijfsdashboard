"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";

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
  List,
  ClipboardList,
  Truck,
} from "lucide-react";
import { EyeOff } from "lucide-react";
import { registerRoute } from "./_components/routeRegistry"; // ✅ breadcrumb-registratie

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const bgColorMap: Record<string, string> = {
  green: "bg-green-100 text-green-900 hover:bg-green-200",
  pink: "bg-pink-100 text-pink-900 hover:bg-pink-200",
  purple: "bg-purple-100 text-purple-900 hover:bg-purple-200",
  blue: "bg-sky-100 text-sky-900 hover:bg-sky-200",
  red: "bg-rose-100 text-rose-900 hover:bg-rose-200",
  slate: "bg-slate-100 text-slate-900 hover:bg-slate-200",
  orange: "bg-orange-100 text-orange-900 hover:bg-orange-200",
  gray: "bg-gray-100 text-gray-900 hover:bg-gray-200",
  yellow: "bg-yellow-100 text-yellow-900 hover:bg-yellow-200",
  amber: "bg-amber-100  text-amber-900  hover:bg-amber-200",
  teal: "bg-teal-100   text-teal-900   hover:bg-teal-200",
  indigo: "bg-indigo-100 text-indigo-900 hover:bg-indigo-200",
  emerald: "bg-emerald-100 text-emerald-900 hover:bg-emerald-200",
};

type LinkCardProps = {
  href: string;
  label: string;
  color: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
  breadcrumb?: string; // ✅ optioneel
};

function useVragenTeller(intervalMs = 10000) {
  const [teller, setTeller] = React.useState<number | null>(null);

  const fetchAantal = async () => {
    try {
      const res = await fetch("/api/admin/vragen", { credentials: "include" });
      if (!res.ok) return;
      const data = await res.json();
      const open = Array.isArray(data) ? data.filter((v: any) => !v.antwoord).length : 0;
      setTeller(open);
    } catch {
      setTeller(null);
    }
  };

  React.useEffect(() => {
    fetchAantal();
    const interval = setInterval(fetchAantal, intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);

  return teller;
}

const LinkCard = ({ href, label, color, Icon, breadcrumb }: LinkCardProps) => {
  // ✅ runtime-registratie (voegt alleen toe als nog niet aanwezig)
  if (breadcrumb) registerRoute(href, breadcrumb);

  return (
    <Link
      href={href}
      className={`flex items-center justify-center rounded-lg px-3 py-2 text-sm font-medium shadow transition ${
        bgColorMap[color] || "bg-gray-200 text-gray-900"
      }`}
    >
      <Icon className="mr-2 h-5 w-5" />
      {label}
    </Link>
  );
};

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
        onClick={() => setActiveSection(open ? "" : id)}
        className={`w-full flex items-center justify-between px-6 py-3 font-semibold tracking-tight transition ${
          bgColorMap[color || ""] || "bg-gray-100 text-gray-900 hover:bg-gray-200"
        }`}
      >
        <span>{title}</span>
        {open ? <ChevronDown className="w-5 h-5 opacity-70" /> : <ChevronRight className="w-5 h-5 opacity-70" />}
      </button>
      {open && <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-white">{children}</div>}
    </section>
  );
};

const SubSection = ({
  title,
  color,
  children,
}: {
  title: string;
  color?: string;
  children: React.ReactNode;
}) => {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="col-span-full border rounded-md mb-2">
      <button
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between px-3 py-2 font-semibold text-sm tracking-tight ${
          bgColorMap[color || "gray"]
        }`}
      >
        <span>{title}</span>
        {open ? <ChevronDown className="w-4 h-4 opacity-70" /> : <ChevronRight className="w-4 h-4 opacity-70" />}
      </button>
      {open && <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 p-3 bg-white">{children}</div>}
    </div>
  );
};

function DailyTotalDisplay({ mask = false }: { mask?: boolean }) {
  const today = new Date().toISOString().slice(0, 10).split("-").reverse().join("-");
  const { data } = useSWR("/api/kassa/omzet?start=" + today + "&totalen=1", fetcher);
  const record = Array.isArray(data) ? data[0] : null;
  const cash = record ? parseFloat(record.Cash) || 0 : 0;
  const pin = record ? parseFloat(record.Pin) || 0 : 0;
  const bon = record ? parseFloat(record.Bon) || 0 : 0;
  const total = cash + pin + bon;

  if (mask) {
    return <span className="text-lg font-semibold tracking-widest select-none">••••••</span>;
    }

  return (
    <span className="text-lg font-semibold">
      € {total.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
}

export default function AdminDashboard() {
  // Hooks altijd bovenaan
  const [activeSection, setActive] = React.useState<string>(() => {
    if (typeof window === "undefined") return "meest";
    return localStorage.getItem("activeSection") || "meest";
  });

  // Omzet verbergen/tonen (onthouden in localStorage)
  const [hideOmzet, setHideOmzet] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("omzetHidden") === "1";
    } catch {
      return false;
    }
  });

  const openVragenTeller = useVragenTeller(10000); // elke 10s tijdens testen

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("omzetHidden", hideOmzet ? "1" : "0");
    }
  }, [hideOmzet]);

  let user = null;
  if (typeof window !== "undefined") {
    try {
      user = JSON.parse(localStorage.getItem("gebruiker") || "null");
    } catch {
      user = null;
    }
  }

  // Autorisatie
  if (!user || user.rol !== "beheerder") {
    if (typeof window !== "undefined") {
      window.location.href = "/sign-in";
    }
    return null;
  }

  const setActiveSection = (id: string) => {
    setActive(id);
    localStorage.setItem("activeSection", id);
  };

  return (
    <main className="max-w-6xl mx-auto p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4">
        <h1 className="text-2xl font-bold text-slate-800">Dashboard</h1>

        {/* Rechts: omzet + verbergknop */}
        <div className="mt-2 sm:mt-0 flex items-center gap-2">
          <Link href="/admin/dashboard" className="px-4 py-2 bg-gray-100 rounded hover:bg-gray-200">
            <DailyTotalDisplay mask={hideOmzet} />
          </Link>
          <button
            type="button"
            onClick={() => setHideOmzet((v) => !v)}
            className="p-2 rounded bg-gray-100 hover:bg-gray-200"
            title={hideOmzet ? "Omzet tonen" : "Omzet verbergen"}
            aria-label={hideOmzet ? "Omzet tonen" : "Omzet verbergen"}
          >
            {hideOmzet ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Melding over vragen onder dashboardtitel, altijd apart */}
      {openVragenTeller !== null && openVragenTeller > 0 && (
        <div className="mb-6 text-sm text-red-700 font-semibold">
          📬 {openVragenTeller} onbeantwoorde vragen{openVragenTeller > 1 ? "en" : ""}.
          <Link href="/admin/vragen" className="ml-2 underline text-blue-600">
            Bekijk nu
          </Link>
        </div>
      )}

      {/* 👇 Meest gebruikte onderdelen */}
      <Section
        id="meest"
        title="👥 Meest gebruikte onderdelen"
        color="slate"
        activeSection={activeSection}
        setActiveSection={setActiveSection}
      >
        <LinkCard href="/admin/acties" label="Actielijsten" color="blue" Icon={CheckSquare} breadcrumb="Management – Actielijsten" />
        <LinkCard href="/admin/notities" label="Notities" color="blue" Icon={FileText} breadcrumb="Management – Notities" />
        <LinkCard href="/admin/schoonmaakroutines" label="Schoonmaakroutines" color="blue" Icon={Wrench} breadcrumb="Management – Schoonmaakroutines" />
        <LinkCard href="/admin/shiftbase/rooster" label="Rooster" color="orange" Icon={CalendarDays} breadcrumb="Planning – Rooster" />
        <LinkCard href="/open-diensten" label="Open Shifts" color="orange" Icon={CalendarDays} breadcrumb="Planning – Open Shifts" />
        <LinkCard href="/admin/dossier" label="Dossiers" color="orange" Icon={Folder} breadcrumb="Medewerkers – Dossiers" />
        <LinkCard
          href="/admin/voorraad/bestelpagina"
          label="Bestel-app"
          color="pink"
          Icon={ShoppingCart}
          breadcrumb="Voorraadbeheer, Recepturen & Allergenen – Bestel-app"
        />
        <LinkCard href="/admin/kasstaten" label="Kasstaat invullen" color="teal" Icon={BarChart2} breadcrumb="Import / Invoer – Kasstaat invullen" />
        <LinkCard href="/admin/kasboek" label="Kasboek bijwerken" color="teal" Icon={Wrench} breadcrumb="Import / Invoer – Kasboek bijwerken" />
      </Section>

      {/* 👇 Management */}
      <Section id="management" title="📘 Management" color="blue" activeSection={activeSection} setActiveSection={setActiveSection}>
        <LinkCard href="/admin/acties" label="Actielijsten" color="blue" Icon={CheckSquare} breadcrumb="Management – Actielijsten" />
        <LinkCard href="/admin/notities" label="Notities" color="blue" Icon={FileText} breadcrumb="Management – Notities" />
        <LinkCard href="/admin/vragen" label="Vragen" color="blue" Icon={CheckSquare} breadcrumb="Management – Vragen" />
        <LinkCard href="/admin/schoonmaakroutines" label="Schoonmaakroutines" color="blue" Icon={Wrench} breadcrumb="Management – Schoonmaakroutines" />
        <LinkCard href="/admin/contacten" label="Relaties" color="blue" Icon={Folder} breadcrumb="Management – Relaties" />
      </Section>

      {/* 👇 Planning */}
      <Section id="planning" title="📅 Planning" color="orange" activeSection={activeSection} setActiveSection={setActiveSection}>
        <LinkCard href="/admin/shiftbase/rooster" label="Rooster" color="orange" Icon={CalendarDays} breadcrumb="Planning – Rooster" />
        <LinkCard href="/open-diensten" label="Open Shifts" color="orange" Icon={CalendarDays} breadcrumb="Planning – Open Shifts" />
        <LinkCard href="/admin/rapportages/timesheets" label="Klokuren" color="orange" Icon={Clock} breadcrumb="Planning – Klokuren" />
        <LinkCard href="/shift-acties" label="Shiftacties & Statistieken" color="orange" Icon={Activity} breadcrumb="Planning – Shiftacties & Statistieken" />
        <LinkCard href="/admin/beschikbaarheid/nieuw" label="Beschikbaarheid ingeven" color="orange" Icon={Activity} breadcrumb="Planning – Beschikbaarheid ingeven" />
        <LinkCard href="/admin/beschikbaarheid" label="Beschikbaarheid per medewerker" color="orange" Icon={Activity} breadcrumb="Planning – Beschikbaarheid per medewerker" />
        <LinkCard href="/admin/beschikbaarheid/periode" label="Beschikbaarheid per periode" color="orange" Icon={Activity} breadcrumb="Planning – Beschikbaarheid per periode" />
      </Section>

      {/* 👇 Rapportages */}
      <Section id="rapportages" title="📊 Rapportages" color="purple" activeSection={activeSection} setActiveSection={setActiveSection}>
        <LinkCard
          href="/admin/rapportage/financieel"
          label="Financiële Rapporten"
          color="purple"
          Icon={BarChart2}
          breadcrumb="Rapportages – Financiële Rapporten"
        />
        <LinkCard
          href="/admin/rapportage/medewerkers"
          label="Medewerkers Rapporten"
          color="purple"
          Icon={BarChart2}
          breadcrumb="Rapportages – Medewerkers Rapporten"
        />
        <LinkCard
          href="/admin/aftekenlijsten"
          label="Overzicht formulieren/-rapporten"
          color="purple"
          Icon={BarChart2}
          breadcrumb="Rapportages – Formulieren/-rapporten"
        />
      </Section>

      {/* 👇 Medewerkers */}
      <Section id="medewerkers" title="👥 Medewerkers" color="green" activeSection={activeSection} setActiveSection={setActiveSection}>
        <LinkCard href="/admin/medewerkers" label="Medewerkers beheren" color="green" Icon={User} breadcrumb="Medewerkers – Medewerkers beheren" />
        <LinkCard
          href="/admin/medewerkers/overzicht"
          label="Gegevens medewerkers"
          color="green"
          Icon={Users}
          breadcrumb="Medewerkers – Gegevens medewerkers"
        />
        <LinkCard href="/sollicitatie/pdf" label="Sollicitatiemails" color="green" Icon={FileText} breadcrumb="Medewerkers – Sollicitatiemails" />
        <LinkCard href="/admin/functies" label="Functies" color="green" Icon={Tag} breadcrumb="Medewerkers – Functies" />
        <LinkCard href="/admin/dossier" label="Dossiers" color="green" Icon={Folder} breadcrumb="Medewerkers – Dossiers" />

        <SubSection title="📘 Instructies" color="blue">
          <LinkCard href="/admin/instructies" label="Instructies beheren" color="blue" Icon={FileText} breadcrumb="Medewerkers – Instructies beheren" />
          <LinkCard href="/instructies" label="Instructies medewerkers" color="blue" Icon={Eye} breadcrumb="Medewerkers – Instructies medewerkers" />
        </SubSection>

        <SubSection title="🧠 Skills" color="amber">
          <LinkCard href="/admin/skills/categorieen" label="Beheer categorieën" color="amber" Icon={Tag} breadcrumb="Medewerkers – Beheer categorieën" />
          <LinkCard href="/admin/skills" label="Skills beheer" color="amber" Icon={Layers} breadcrumb="Medewerkers – Skills beheer" />
          <LinkCard href="/admin/skills/toewijzen" label="Skills toewijzen" color="amber" Icon={Activity} breadcrumb="Medewerkers – Skills toewijzen" />
          <LinkCard href="/skills" label="Skills medewerkers" color="amber" Icon={Layers} breadcrumb="Medewerkers – Skills medewerkers" />
        </SubSection>
      </Section>

      {/* 👇 Voorraadbeheer, Recepturen & Allergenen */}
      <Section
        id="voorraad"
        title="📦 Voorraadbeheer, Recepturen & Allergenen"
        color="pink"
        activeSection={activeSection}
        setActiveSection={setActiveSection}
      >
        <LinkCard
          href="/admin/leveranciers"
          label="Leveranciers beheren"
          color="pink"
          Icon={CreditCard}
          breadcrumb="Voorraadbeheer, Recepturen & Allergenen – Leveranciers beheren"
        />
        <LinkCard href="/admin/suikervrij" label="Suikervrij productie" color="pink" Icon={IceCream} breadcrumb="Voorraadbeheer, Recepturen & Allergenen – Suikervrij productie" />
        <LinkCard href="/admin/voorraad/artikelen" label="Artikelen beheren" color="pink" Icon={Box} breadcrumb="Voorraadbeheer, Recepturen & Allergenen – Artikelen beheren" />
        <LinkCard
          href="/admin/voorraad/bestelpagina"
          label="Bestel-app"
          color="pink"
          Icon={ClipboardList}
          breadcrumb="Voorraadbeheer, Recepturen & Allergenen – Bestel-app"
        />
        <LinkCard href="/admin/recepten" label="Receptprijs" color="pink" Icon={Truck} breadcrumb="Voorraadbeheer, Recepturen & Allergenen – Receptprijs" />
        <LinkCard
          href="/admin/producten/allergenen"
          label="Allergenenregistratie"
          color="pink"
          Icon={List}
          breadcrumb="Voorraadbeheer, Recepturen & Allergenen – Allergenenregistratie"
        />
        <LinkCard href="/admin/recepten/allergenen" label="Allergenenkaart" color="pink" Icon={List} breadcrumb="Voorraadbeheer, Recepturen & Allergenen – Allergenenkaart" />
      </Section>

      {/* 👇 Import / Invoer */}
      <Section id="import_invoer" title="📊 Import / Invoer" color="teal" activeSection={activeSection} setActiveSection={setActiveSection}>
        <LinkCard href="/admin/kassa-omzet" label="Omzet inlezen" color="teal" Icon={Wrench} breadcrumb="Import / Invoer – Omzet inlezen" />
        <LinkCard href="/admin/mypos" label="Inlezen myPOS (maand)" color="teal" Icon={Archive} breadcrumb="Import / Invoer – Inlezen myPOS (maand)" />
        <LinkCard href="/admin/omzet/loonkosten" label="Invoeren loonkosten" color="teal" Icon={Archive} breadcrumb="Import / Invoer – Invoeren loonkosten" />
        <LinkCard
          href="/admin/aftekenlijsten/upload"
          label="Upload formulieren"
          color="teal"
          Icon={Archive}
          breadcrumb="Import / Invoer – Upload formulieren"
        />
        <LinkCard href="/admin/kasstaten" label="Kasstaat invullen" color="teal" Icon={BarChart2} breadcrumb="Import / Invoer – Kasstaat invullen" />
        <LinkCard href="/admin/kasboek" label="Kasboek bijwerken" color="teal" Icon={Wrench} breadcrumb="Import / Invoer – Kasboek bijwerken" />
        <LinkCard href="/admin/omzet/omzetdagen" label="Omzetdagen aanpassen" color="teal" Icon={Wrench} breadcrumb="Import / Invoer – Omzetdagen aanpassen" />
      </Section>

      {/* 👇 Prognosetools */}
      <Section id="prognosetools" title="📊 Prognosetools" color="indigo" activeSection={activeSection} setActiveSection={setActiveSection}>
        <LinkCard href="/admin/planning/forecast" label="Forecast planning" color="indigo" Icon={Wrench} breadcrumb="Prognosetools – Forecast planning" />
      </Section>
    </main>
  );
}
