"use client";

import { usePathname } from "next/navigation";
import { matchRoute } from "./routeRegistry";
import { ChevronRight } from "lucide-react";

export default function Breadcrumbs() {
  const pathname = usePathname();
  const match = matchRoute(pathname);

  if (!match) return null;

  return (
    <div className="mb-4 flex items-center text-sm">
      {/* Icoon links */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="currentColor"
        className="w-5 h-5 text-slate-500 mr-2"
      >
        <path
          fillRule="evenodd"
          d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM10.5 8.25a.75.75 0 00-1.5 0v7.5a.75.75 0 001.5 0v-7.5zm4.5 0a.75.75 0 00-1.5 0v7.5a.75.75 0 001.5 0v-7.5z"
          clipRule="evenodd"
        />
      </svg>

      {/* Tekst */}
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
