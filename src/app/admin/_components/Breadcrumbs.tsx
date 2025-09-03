"use client";

import { usePathname } from "next/navigation";
import { matchRoute } from "./routeRegistry";
import {
  ChevronRight,
  FolderTree,
} from "lucide-react";

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

  // split breadcrumb "Management – Actielijsten"
  const parts = match.breadcrumb.split(" – ");
  const section = parts[0];
  const current = parts[1];
  const color = sectionColors[section] || "text-slate-700";

  return (
    <div className="mb-4 flex items-center text-sm">
      {/* Icoon in sectiekleur */}
      <FolderTree className={`w-5 h-5 mr-2 ${color}`} />

      {/* Tekst met chevrons */}
      <span className="font-semibold flex items-center gap-1">
        <span className={color}>{section}</span>
        <ChevronRight className="inline-block w-4 h-4 mx-1 text-slate-400" />
        <span className="text-slate-900">{current}</span>
      </span>
    </div>
  );
}
