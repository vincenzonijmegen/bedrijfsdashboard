"use client";

import Link from "next/link";
import { BookOpen, ClipboardCheck, ListChecks, LogOut } from "lucide-react";

const tegels = [
    {
    href: "/keuken/maaklijst",
    titel: "Maaklijst",
    omschrijving: "Klik aan wat bijgemaakt moet worden.",
    soort: "normaal",
    Icon: ListChecks,
  },
  {
    href: "/keuken/recepturen",
    titel: "Recepturen",
    omschrijving: "Bekijk recepturen per categorie.",
    soort: "normaal",
    Icon: BookOpen,
  },
  {
    href: "/keuken/instructies-skills",
    titel: "Werkinstructies / skills",
    omschrijving: "Open keukeninstructies en skills.",
    soort: "normaal",
    Icon: ClipboardCheck,
  },
  {
    href: "/routines/keuken-opstart",
    titel: "Keuken - opstartroutine",
    omschrijving: "Werk de lijst af.",
    soort: "haccp",
    Icon: ClipboardCheck,
  },
  {
    href: "/routines/keuken-afsluit",
    titel: "Keuken - afsluitroutine",
    omschrijving: "Werk de lijst af.",
    soort: "haccp",
    Icon: ClipboardCheck,
  },
  {
    href: "/routines/keuken-eindschoonmaak",
    titel: "Keuken - eindschoonmaak",
    omschrijving: "Werk de lijst af.",
    soort: "haccp",
    Icon: ClipboardCheck,
  },
];

export default function KeukenHomePage() {
  async function handleLogout() {
    const ok = confirm("Weet je zeker dat je wilt uitloggen?");
    if (!ok) return;

    await fetch("/api/keuken/logout", { method: "POST" });
    window.location.href = "/keuken/login";
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              Keuken iPad
            </p>
            <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">
              Keukenoverzicht
            </h1>
            <p className="mt-2 max-w-2xl text-base text-slate-600">
              Snelle toegang tot recepturen, werkinstructies en de maaklijst.
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm active:scale-95"
          >
            <LogOut className="h-4 w-4" />
            Uitloggen
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {tegels.map((tegel) => {
            const Icon = tegel.Icon;
            const isHaccp = tegel.soort === "haccp";

            return (
              <Link
                key={tegel.href}
                href={tegel.href}
                className={[
                  "group relative overflow-hidden rounded-3xl border p-6 shadow-sm transition active:scale-95",
                  isHaccp
                    ? "border-emerald-200 bg-emerald-50/70 hover:bg-emerald-50"
                    : "border-slate-200 bg-white hover:bg-slate-50",
                ].join(" ")}
              >
                {isHaccp && (
                  <div className="absolute right-4 top-4 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-700">
                    HACCP
                  </div>
                )}

                <div className="flex items-start gap-4">
                  <div
                    className={[
                      "flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl",
                      isHaccp
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-blue-50 text-blue-600",
                    ].join(" ")}
                  >
                    <Icon className="h-7 w-7" />
                  </div>

                  <div>
                    <h2 className="pr-14 text-2xl font-bold text-slate-900">
                      {tegel.titel}
                    </h2>
                    <p className="mt-3 text-base text-slate-600">
                      {tegel.omschrijving}
                    </p>
                    <div className="mt-6 text-base font-semibold text-slate-900">
                      Openen →
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}