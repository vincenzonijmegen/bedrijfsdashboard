"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { matchRoute } from "./routeRegistry";
import { ChevronRight, FolderTree } from "lucide-react";

// sectie → tekstkleur (matcht jouw sectiekleuren)
const sectionColors: Record<string, string> = {
  Management: "text-sky-600",
  Planning: "text-orange-600",
  Rapportages: "text-purple-600",
  Medewerkers: "text-green-600",
  "Voorraadbeheer, Recepturen & Allergenen": "text-pink-600",
  "Import / Invoer": "text-teal-600",
  Prognosetools: "text-indigo-600",
};

// sectie → ANKER-ID op /admin (zoals in jouw <Section id="...">)
const sectionAnchors: Record<string, string> = {
  Management: "management",
  Planning: "planning",
  Rapportages: "rapportages",
  Medewerkers: "medewerkers",
  "Voorraadbeheer, Recepturen & Allergenen": "voorraad",
  "Import / Invoer": "import_invoer",
  Prognosetools: "prognosetools",
};

export default function Breadcrumbs() {
  const pathname = usePathname();
  const match = matchRoute(pathname);
  if (!match) return null;

  // "Sectie – Subpagina"
  const [section, current] = match.breadcrumb.split(" – ");
  const color = sectionColors[section] || "text-slate-700";
  const anchor = sectionAnchors[section];
  const sectionHref = anchor ? `/admin#${anchor}` : "/admin";

  return (
    <div className="mb-4 flex items-center text-sm">
      <FolderTree className={`w-5 h-5 mr-2 ${color}`} />
      <span className="font-semibold flex items-center gap-1">
        <Link href={sectionHref} className={`${color} hover:underline`}>
          {section}
        </Link>
        <ChevronRight className="inline-block w-4 h-4 mx-1 text-slate-400" />
        <span className="text-slate-900">{current}</span>
      </span>
    </div>
  );
}
