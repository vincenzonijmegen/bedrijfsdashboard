"use client";

export type RouteEntry = { href: string; breadcrumb: string };

// Vooraf ingevuld op basis van jouw admin/page.tsx
const registry: RouteEntry[] = [
  // Management
  { href: "/admin/acties", breadcrumb: "Management – Actielijsten" },
  { href: "/admin/notities", breadcrumb: "Management – Notities" },
  { href: "/admin/vragen", breadcrumb: "Management – Vragen" },
  { href: "/admin/schoonmaakroutines", breadcrumb: "Management – Schoonmaakroutines" },
  { href: "/admin/contacten", breadcrumb: "Management – Relaties" },

  // Planning
  { href: "/admin/shiftbase/rooster", breadcrumb: "Planning – Rooster" },
  { href: "/open-diensten", breadcrumb: "Planning – Open Shifts" },
  { href: "/admin/rapportages/timesheets", breadcrumb: "Planning – Klokuren" },
  { href: "/shift-acties", breadcrumb: "Planning – Shiftacties & Statistieken" },
  { href: "/admin/beschikbaarheid/nieuw", breadcrumb: "Planning – Beschikbaarheid ingeven" },
  { href: "/admin/beschikbaarheid", breadcrumb: "Planning – Beschikbaarheid per medewerker" },
  { href: "/admin/beschikbaarheid/periode", breadcrumb: "Planning – Beschikbaarheid per periode" },

  // Rapportages
  { href: "/admin/rapportage/financieel", breadcrumb: "Rapportages – Financiële Rapporten" },
  { href: "/admin/rapportage/medewerkers", breadcrumb: "Rapportages – Medewerkers Rapporten" },
  { href: "/admin/aftekenlijsten", breadcrumb: "Rapportages – Hygiëne-formulieren/-rapporten" },

  // Medewerkers
  { href: "/admin/medewerkers", breadcrumb: "Medewerkers – Medewerkers beheren" },
  { href: "/admin/medewerkers/overzicht", breadcrumb: "Medewerkers – Gegevens medewerkers" },
  { href: "/sollicitatie/pdf", breadcrumb: "Medewerkers – Sollicitatiemails" },
  { href: "/admin/functies", breadcrumb: "Medewerkers – Functies" },
  { href: "/admin/dossier", breadcrumb: "Medewerkers – Dossiers" },
  { href: "/admin/instructies", breadcrumb: "Medewerkers – Instructies beheren" },
  { href: "/instructies", breadcrumb: "Medewerkers – Instructies medewerkers" },
  { href: "/admin/skills/categorieen", breadcrumb: "Medewerkers – Beheer categorieën" },
  { href: "/admin/skills", breadcrumb: "Medewerkers – Skills beheer" },
  { href: "/admin/skills/toewijzen", breadcrumb: "Medewerkers – Skills toewijzen" },
  { href: "/skills", breadcrumb: "Medewerkers – Skills medewerkers" },

  // Voorraadbeheer, Recepturen & Allergenen
  { href: "/admin/leveranciers", breadcrumb: "Voorraadbeheer, Recepturen & Allergenen – Leveranciers beheren" },
  { href: "/admin/suikervrij", breadcrumb: "Voorraadbeheer, Recepturen & Allergenen – Suikervrij productie" },
  { href: "/admin/voorraad/artikelen", breadcrumb: "Voorraadbeheer, Recepturen & Allergenen – Artikelen beheren" },
  { href: "/admin/voorraad/bestelpagina", breadcrumb: "Voorraadbeheer, Recepturen & Allergenen – Bestel-app" },
  { href: "/admin/recepten", breadcrumb: "Voorraadbeheer, Recepturen & Allergenen – Receptprijs" },
  { href: "/admin/producten/allergenen", breadcrumb: "Voorraadbeheer, Recepturen & Allergenen – Allergenenregistratie" },
  { href: "/admin/recepten/allergenen", breadcrumb: "Voorraadbeheer, Recepturen & Allergenen – Allergenenkaart" },

  // Import / Invoer
  { href: "/admin/kassa-omzet", breadcrumb: "Import / Invoer – Omzet inlezen" },
  { href: "/admin/mypos", breadcrumb: "Import / Invoer – Inlezen myPOS (maand)" },
  { href: "/admin/omzet/loonkosten", breadcrumb: "Import / Invoer – Invoeren loonkosten" },
  { href: "/admin/aftekenlijsten/upload", breadcrumb: "Import / Invoer – Upload hygiëne-formulieren" },
  { href: "/admin/kasstaten", breadcrumb: "Import / Invoer – Kasstaat invullen" },
  { href: "/admin/kasboek", breadcrumb: "Import / Invoer – Kasboek bijwerken" },
  { href: "/admin/omzet/omzetdagen", breadcrumb: "Import / Invoer – Omzetdagen aanpassen" },

  // Prognosetools
  { href: "/admin/planning/forecast", breadcrumb: "Prognosetools – Forecast planning" },
];

// Optioneel: runtime-registratie (voorkomt dubbele entries)
export function registerRoute(href: string, breadcrumb?: string) {
  if (!breadcrumb) return;
  if (!registry.find(r => r.href === href)) {
    registry.push({ href, breadcrumb });
  }
}

// Vind de beste match (langste prefix)
export function matchRoute(pathname: string): RouteEntry | undefined {
  const path = pathname.split("?")[0].replace(/\/$/, "");
  const sorted = [...registry].sort((a, b) => b.href.length - a.href.length);
  return sorted.find(r => path === r.href || path.startsWith(r.href + "/"));
}
