"use client";

import * as React from "react";
import Link from "next/link";
import useSWR from "swr";

import {
  User,
  Users,
  UserPlus,
  Tag,
  FileText,
  Folder,
  Eye,
  EyeOff,
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
import { registerRoute } from "./_components/routeRegistry";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type SollicitatieAfspraakVandaag = {
  id: number;
  naam: string;
  email: string;
  starttijd: string;
  eindtijd: string;
  status: string;
};

const bgColorMap: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-800 ring-emerald-100 hover:bg-emerald-100",
  pink: "bg-pink-50 text-pink-800 ring-pink-100 hover:bg-pink-100",
  purple: "bg-purple-50 text-purple-800 ring-purple-100 hover:bg-purple-100",
  blue: "bg-blue-50 text-blue-800 ring-blue-100 hover:bg-blue-100",
  red: "bg-red-50 text-red-800 ring-red-100 hover:bg-red-100",
  slate: "bg-slate-50 text-slate-800 ring-slate-200 hover:bg-slate-100",
  orange: "bg-orange-50 text-orange-800 ring-orange-100 hover:bg-orange-100",
  gray: "bg-slate-50 text-slate-800 ring-slate-200 hover:bg-slate-100",
  yellow: "bg-yellow-50 text-yellow-800 ring-yellow-100 hover:bg-yellow-100",
  amber: "bg-amber-50 text-amber-800 ring-amber-100 hover:bg-amber-100",
  teal: "bg-teal-50 text-teal-800 ring-teal-100 hover:bg-teal-100",
  indigo: "bg-indigo-50 text-indigo-800 ring-indigo-100 hover:bg-indigo-100",
  emerald: "bg-emerald-50 text-emerald-800 ring-emerald-100 hover:bg-emerald-100",
};

type LinkCardProps = {
  href: string;
  label: string;
  color: string;
  Icon: React.FC<React.SVGProps<SVGSVGElement>>;
  breadcrumb?: string;
  target?: string;
  rel?: string;
};

function useVragenTeller(intervalMs = 10000) {
  const [teller, setTeller] = React.useState<number | null>(null);

  const fetchAantal = async () => {
    try {
      const res = await fetch("/api/admin/vragen", { credentials: "include" });
      if (!res.ok) return;

      const data = await res.json();
      const open = Array.isArray(data)
        ? data.filter((v: any) => !v.antwoord).length
        : 0;

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

const LinkCard = ({
  href,
  label,
  color,
  Icon,
  breadcrumb,
  target,
  rel,
}: LinkCardProps) => {
  if (breadcrumb) registerRoute(href, breadcrumb);

  return (
    <Link
      href={href}
      target={target}
      rel={rel}
      className={`flex items-center justify-center rounded-xl px-3 py-2.5 text-sm font-semibold shadow-sm ring-1 transition ${
        bgColorMap[color] ||
        "bg-slate-50 text-slate-800 ring-slate-200 hover:bg-slate-100"
      }`}
    >
      <Icon className="mr-2 h-5 w-5 shrink-0" />
      <span className="truncate">{label}</span>
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

const Section = ({
  id,
  title,
  children,
  color,
  activeSection,
  setActiveSection,
}: SectionProps) => {
  const open = id === activeSection;

  return (
    <section className="mb-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <button
        onClick={() => setActiveSection(open ? "" : id)}
        className={`flex w-full items-center justify-between px-5 py-4 text-left font-bold tracking-tight ring-1 transition ${
          bgColorMap[color || ""] ||
          "bg-slate-50 text-slate-800 ring-slate-200 hover:bg-slate-100"
        }`}
      >
        <span>{title}</span>
        {open ? (
          <ChevronDown className="h-5 w-5 opacity-70" />
        ) : (
          <ChevronRight className="h-5 w-5 opacity-70" />
        )}
      </button>

      {open && (
        <div className="grid grid-cols-1 gap-3 bg-white p-4 sm:grid-cols-2 md:grid-cols-3">
          {children}
        </div>
      )}
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
    <div className="col-span-full overflow-hidden rounded-xl border border-slate-200 bg-white">
      <button
        onClick={() => setOpen(!open)}
        className={`flex w-full items-center justify-between px-4 py-3 text-left text-sm font-bold tracking-tight ring-1 transition ${
          bgColorMap[color || "gray"]
        }`}
      >
        <span>{title}</span>
        {open ? (
          <ChevronDown className="h-4 w-4 opacity-70" />
        ) : (
          <ChevronRight className="h-4 w-4 opacity-70" />
        )}
      </button>

      {open && (
        <div className="grid grid-cols-1 gap-3 bg-white p-3 sm:grid-cols-2 md:grid-cols-3">
          {children}
        </div>
      )}
    </div>
  );
};

function DailyTotalDisplay({ mask = false }: { mask?: boolean }) {
  const today = new Date().toISOString().slice(0, 10).split("-").reverse().join("-");
  const { data } = useSWR(
    "/api/kassa/omzet?start=" + today + "&totalen=1",
    fetcher
  );

  const record = Array.isArray(data) ? data[0] : null;
  const cash = record ? parseFloat(record.Cash) || 0 : 0;
  const pin = record ? parseFloat(record.Pin) || 0 : 0;
  const bon = record ? parseFloat(record.Bon) || 0 : 0;
  const total = cash + pin + bon;

  if (mask) {
    return (
      <span className="text-lg font-bold tracking-widest text-slate-950 select-none">
        ••••••
      </span>
    );
  }

  return (
    <span className="text-lg font-bold text-slate-950">
      €{" "}
      {total.toLocaleString("nl-NL", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}
    </span>
  );
}

export default function AdminDashboard() {
  const [activeSection, setActive] = React.useState<string>(() => {
    if (typeof window === "undefined") return "meest";
    return localStorage.getItem("activeSection") || "meest";
  });

  const [hideOmzet, setHideOmzet] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    try {
      return localStorage.getItem("omzetHidden") === "1";
    } catch {
      return false;
    }
  });

  const { data: afsprakenVandaag } = useSWR<SollicitatieAfspraakVandaag[]>(
    "/api/calendly/vandaag",
    fetcher,
    { refreshInterval: 60000 }
  );

  const openVragenTeller = useVragenTeller(10000);

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
    <main className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-1 text-sm font-medium text-blue-600">
                IJssalon Vincenzo / Beheer
              </div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Dashboard
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Snel naar de belangrijkste onderdelen van het bedrijfsdashboard.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                href="/admin/dashboard"
                className="inline-flex h-11 items-center rounded-xl bg-blue-50 px-4 text-sm font-semibold text-blue-950 ring-1 ring-blue-100 transition hover:bg-blue-100"
              >
                <DailyTotalDisplay mask={hideOmzet} />
              </Link>

              <button
                type="button"
                onClick={() => setHideOmzet((v) => !v)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50"
                title={hideOmzet ? "Omzet tonen" : "Omzet verbergen"}
                aria-label={hideOmzet ? "Omzet tonen" : "Omzet verbergen"}
              >
                {hideOmzet ? (
                  <Eye className="h-5 w-5" />
                ) : (
                  <EyeOff className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>
        </div>

        {afsprakenVandaag && afsprakenVandaag.length > 0 && (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="font-bold text-emerald-950">
                Sollicitatiegesprekken vandaag
              </h2>

              <Link
                href="/admin/sollicitaties/afspraken"
                className="text-sm font-semibold text-emerald-800 underline"
              >
                Bekijk alles
              </Link>
            </div>

            <div className="space-y-2">
              {afsprakenVandaag.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-col rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <div className="font-semibold text-slate-950">{a.naam}</div>
                    <div className="text-slate-500">{a.email}</div>
                  </div>

                  <div className="mt-2 rounded-full bg-emerald-50 px-3 py-1 text-sm font-bold text-emerald-700 ring-1 ring-emerald-100 sm:mt-0">
                    {new Date(a.starttijd).toLocaleTimeString("nl-NL", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {openVragenTeller !== null && openVragenTeller > 0 && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 shadow-sm">
            📬 {openVragenTeller} onbeantwoorde vraag
            {openVragenTeller > 1 ? "en" : ""}.
            <Link href="/admin/vragen" className="ml-2 text-blue-700 underline">
              Bekijk nu
            </Link>
          </div>
        )}

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
          <LinkCard href="/admin/voorraad/bestelpagina" label="Bestel-app" color="pink" Icon={ShoppingCart} breadcrumb="Voorraadbeheer, Recepturen & Allergenen – Bestel-app" />
          <LinkCard href="/admin/kasstaten" label="Kasstaat invullen" color="teal" Icon={BarChart2} breadcrumb="Import / Invoer – Kasstaat invullen" />
          <LinkCard href="/admin/kasboek" label="Kasboek bijwerken" color="teal" Icon={Wrench} breadcrumb="Import / Invoer – Kasboek bijwerken" />
        </Section>

        <Section id="management" title="📘 Management" color="blue" activeSection={activeSection} setActiveSection={setActiveSection}>
          <LinkCard href="/admin/acties" label="Actielijsten" color="blue" Icon={CheckSquare} breadcrumb="Management – Actielijsten" />
          <LinkCard href="/admin/notities" label="Notities" color="blue" Icon={FileText} breadcrumb="Management – Notities" />
          <LinkCard href="/admin/schoonmaakroutines" label="Schoonmaakroutines" color="blue" Icon={Wrench} breadcrumb="Management – Schoonmaakroutines" />
          <LinkCard href="/admin/contacten" label="Relaties" color="blue" Icon={Folder} breadcrumb="Management – Relaties" />
          <LinkCard href="/admin/routines" label="Routines HACCP" color="blue" Icon={Folder} breadcrumb="Management – Routines HACCP" />
          <LinkCard href="/keuken/login" label="Keuken-app openen" color="blue" Icon={Wrench} breadcrumb="Keuken-app" target="_blank" rel="noopener noreferrer" />
          <LinkCard href="/winkel/login" label="Winkel-app openen" color="blue" Icon={Wrench} breadcrumb="Winkel-app" target="_blank" rel="noopener noreferrer" />
        </Section>

        <Section id="planning" title="📅 Planning" color="orange" activeSection={activeSection} setActiveSection={setActiveSection}>
          <LinkCard href="/admin/shiftbase/rooster" label="Rooster" color="orange" Icon={CalendarDays} breadcrumb="Planning – Rooster" />
          <LinkCard href="/open-diensten" label="Open Shifts" color="orange" Icon={CalendarDays} breadcrumb="Planning – Open Shifts" />
          <LinkCard href="/admin/rapportages/timesheets" label="Klokuren" color="orange" Icon={Clock} breadcrumb="Planning – Klokuren" />
          <LinkCard href="/admin/beschikbaarheid/nieuw" label="Beschikbaarheid ingeven" color="orange" Icon={Activity} breadcrumb="Planning – Beschikbaarheid ingeven" />
          <LinkCard href="/admin/beschikbaarheid" label="Beschikbaarheid per medewerker" color="orange" Icon={Activity} breadcrumb="Planning – Beschikbaarheid per medewerker" />
          <LinkCard href="/admin/beschikbaarheid/periode" label="Beschikbaarheid per periode" color="orange" Icon={Activity} breadcrumb="Planning – Beschikbaarheid per periode" />
        </Section>

        <Section id="rapportages" title="📊 Rapportages" color="purple" activeSection={activeSection} setActiveSection={setActiveSection}>
          <LinkCard href="/admin/rapportage/financieel" label="Financiële Rapporten" color="purple" Icon={BarChart2} breadcrumb="Rapportages – Financiële Rapporten" />
          <LinkCard href="/admin/rapportage/medewerkers" label="Medewerkers Rapporten" color="purple" Icon={BarChart2} breadcrumb="Rapportages – Medewerkers Rapporten" />
          <LinkCard href="/admin/aftekenlijsten" label="Overzicht formulieren/rapporten" color="purple" Icon={BarChart2} breadcrumb="Rapportages – Formulieren/-rapporten" />
          <LinkCard href="/admin/rapportage/haccp" label="HACCP Rapportage" color="purple" Icon={BarChart2} breadcrumb="Rapportages – HACCP" />
        </Section>

        <Section id="medewerkers" title="👥 Medewerkers" color="green" activeSection={activeSection} setActiveSection={setActiveSection}>
          <LinkCard href="/admin/medewerkers" label="Medewerkers beheren" color="green" Icon={User} breadcrumb="Medewerkers – Medewerkers beheren" />
          <LinkCard href="/admin/medewerkers/overzicht" label="Gegevens medewerkers" color="green" Icon={Users} breadcrumb="Medewerkers – Gegevens medewerkers" />
          <LinkCard href="/sollicitatie/pdf" label="Sollicitatiemails" color="green" Icon={FileText} breadcrumb="Medewerkers – Sollicitatiemails" />
          <LinkCard href="/admin/sollicitaties" label="Sollicitaties" color="green" Icon={UserPlus} breadcrumb="Medewerkers – Sollicitaties" />
          <LinkCard href="/admin/sollicitaties/afspraken" label="Sollicitatiegesprekken" color="green" Icon={CalendarDays} breadcrumb="Medewerkers – Sollicitatiegesprekken" />
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

        <Section id="voorraad" title="📦 Voorraadbeheer, Recepturen & Allergenen" color="pink" activeSection={activeSection} setActiveSection={setActiveSection}>
          <LinkCard href="/admin/leveranciers" label="Leveranciers beheren" color="pink" Icon={CreditCard} breadcrumb="Voorraadbeheer, Recepturen & Allergenen – Leveranciers beheren" />
          <LinkCard href="/admin/suikervrij" label="Suikervrij productie" color="pink" Icon={IceCream} breadcrumb="Voorraadbeheer, Recepturen & Allergenen – Suikervrij productie" />
          <LinkCard href="/admin/voorraad/artikelen" label="Artikelen beheren" color="pink" Icon={Box} breadcrumb="Voorraadbeheer, Recepturen & Allergenen – Artikelen beheren" />
          <LinkCard href="/admin/voorraad/bestelpagina" label="Bestel-app" color="pink" Icon={ClipboardList} breadcrumb="Voorraadbeheer, Recepturen & Allergenen – Bestel-app" />
          <LinkCard href="/admin/recepten" label="Receptprijs" color="pink" Icon={Truck} breadcrumb="Voorraadbeheer, Recepturen & Allergenen – Receptprijs" />
          <LinkCard href="/admin/recepturen" label="Recepturen keuken" color="pink" Icon={List} breadcrumb="Voorraadbeheer, Recepturen & Allergenen – Recepturen keuken" />
          <LinkCard href="/admin/keuken/productie-log" label="Productie keuken" color="pink" Icon={BarChart2} breadcrumb="Voorraadbeheer, Recepturen & Allergenen – Productie keuken" />
          <LinkCard href="/admin/keuken/categorieen" label="Categorie Keuken" color="pink" Icon={Folder} breadcrumb="Voorraadbeheer, Recepturen & Allergenen – Categorieen" />
          <LinkCard href="/admin/producten/allergenen" label="Allergenenregistratie" color="pink" Icon={List} breadcrumb="Voorraadbeheer, Recepturen & Allergenen – Allergenenregistratie" />
          <LinkCard href="/admin/recepten/allergenen" label="Allergenenkaart" color="pink" Icon={List} breadcrumb="Voorraadbeheer, Recepturen & Allergenen – Allergenenkaart" />
        </Section>

        <Section id="import_invoer" title="📊 Import / Invoer" color="teal" activeSection={activeSection} setActiveSection={setActiveSection}>
          <LinkCard href="/admin/kassa-omzet" label="Omzet inlezen" color="teal" Icon={Wrench} breadcrumb="Import / Invoer – Omzet inlezen" />
          <LinkCard href="/admin/mypos" label="Inlezen myPOS (maand)" color="teal" Icon={Archive} breadcrumb="Import / Invoer – Inlezen myPOS (maand)" />
          <LinkCard href="/admin/omzet/loonkosten" label="Invoeren loonkosten" color="teal" Icon={Archive} breadcrumb="Import / Invoer – Invoeren loonkosten" />
          <LinkCard href="/admin/aftekenlijsten/upload" label="Upload formulieren" color="teal" Icon={Archive} breadcrumb="Import / Invoer – Upload formulieren" />
          <LinkCard href="/admin/kasstaten" label="Kasstaat invullen" color="teal" Icon={BarChart2} breadcrumb="Import / Invoer – Kasstaat invullen" />
          <LinkCard href="/admin/kasboek" label="Kasboek bijwerken" color="teal" Icon={Wrench} breadcrumb="Import / Invoer – Kasboek bijwerken" />
          <LinkCard href="/admin/omzet/omzetdagen" label="Omzetdagen aanpassen" color="teal" Icon={Wrench} breadcrumb="Import / Invoer – Omzetdagen aanpassen" />
        </Section>
      </div>
    </main>
  );
}