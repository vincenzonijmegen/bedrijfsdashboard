"use client";

import Link from "next/link";

const tegels = [
      {
  href: "/routines/winkel-opstart?from=/winkel",
  titel: "Winkel - opstartroutine",
  omschrijving: "Werk de lijst af.",
},
{
  href: "/routines/winkel-afsluit?from=/winkel",
  titel: "Winkel - afsluitroutine",
  omschrijving: "Werk de lijst af.",
},
];

export default function KeukenHomePage() {
  async function handleLogout() {
    const ok = confirm("Weet je zeker dat je wilt uitloggen?");
    if (!ok) return;

    await fetch("/api/keuken/logout", { method: "POST" });
    window.location.href = "/winkel/login";
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
              Winkel iPad
            </p>
            <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">
              Winkel overzicht
            </h1>
            <p className="mt-2 max-w-2xl text-base text-slate-600">
              .
            </p>
          </div>

          <button
            onClick={handleLogout}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
          >
            Uitloggen
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {tegels.map((tegel) => (
            <Link
              key={tegel.href}
              href={tegel.href}
              className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <h2 className="text-2xl font-bold text-slate-900">
                {tegel.titel}
              </h2>
              <p className="mt-3 text-base text-slate-600">
                {tegel.omschrijving}
              </p>
              <div className="mt-6 text-base font-semibold text-slate-900">
                Openen →
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
