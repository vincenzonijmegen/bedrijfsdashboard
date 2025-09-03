"use client";

import { usePathname } from "next/navigation";
import { matchRoute } from "./routeRegistry";
import { ChevronRight, FolderTree } from "lucide-react";

export default function Breadcrumbs() {
  const pathname = usePathname();
  const match = matchRoute(pathname);

  if (!match) return null;

  return (
    <div className="mb-4 flex items-center text-sm">
      {/* Icoon links */}
      <FolderTree className="w-5 h-5 text-slate-500 mr-2" />

      {/* Tekst met chevrons */}
      <span className="font-semibold text-slate-700 flex items-center gap-1">
        {match.breadcrumb.split(" – ").map((part, idx, arr) => (
          <span key={idx} className={idx === arr.length - 1 ? "text-slate-900" : ""}>
            {part}
            {idx < arr.length - 1 && (
              <ChevronRight className="inline-block w-4 h-4 mx-1 text-slate-400" />
            )}
          </span>
        ))}
      </span>
    </div>
  );
}
