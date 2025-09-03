"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { matchRoute } from "./routeRegistry";
import { ChevronRight, FolderTree } from "lucide-react";

// mapping sectie → kleur
const sectionColors: Record<string, string> = {
  Management: "text-sky-600",           // blauw
  Planning: "text-orange-600",          // oranje
  Rapportages: "text-purple-600",       // paars
  Medewerkers: "text-green-600",        // groen
  "Voorraadbeheer, Recepturen & Allergenen": "text-pink-600",
  "Import / Invoer": "text-teal-600",
  Prognosetools: "text-indigo-600",
};

export default function Breadcrumbs() {
  const pathname = usePathname();
  const match = matchRoute(pathname);

  if (!match) return null;

  // breadcrumb altijd "Sectie – Subpagina"
  const [section, current] = match.breadcrumb.split(" – ");
  const color = sectionColors[section] || "text-slate-700";

  // route terug naar admin/sectie (optioneel: zelf mappen)
  const sectionHref = `/admin/${section.toLowerCase().replace(/[^a-z0-9]+/g, "")}`;

  return (
    <div className="mb-4 flex items-center text-sm">
      <FolderTree className={`w-5 h-5 mr-2 ${color}`} />

      <span className="font-semibold flex items-center gap-1">
        {/* Sectie klikbaar */}
        <Link href={sectionHref} className={`${color} hover:underline`}>
          {section}
        </Link>
        <ChevronRight className="inline-block w-4 h-4 mx-1 text-slate-400" />
        <span className="text-slate-900">{current}</span>
      </span>
    </div>
  );
}
