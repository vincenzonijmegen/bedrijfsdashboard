"use client";

import { useRouter } from "next/navigation";

export default function MedewerkerPagina() {
  const router = useRouter();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto flex min-h-[70vh] max-w-xl items-center">
        <section className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <p className="text-sm font-medium text-blue-700">
              IJssalon Vincenzo
            </p>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Werkinstructies ontvang je per mail
            </h1>

            <p className="text-sm leading-6 text-slate-600">
              Medewerkers hebben geen apart account meer nodig voor de
              werkinstructies. Je ontvangt de instructies stap voor stap per
              mail, met daarin een persoonlijke link waarmee je de instructie
              direct kunt openen.
            </p>

            <p className="text-sm leading-6 text-slate-600">
              Heb je een vraag over je instructies of mis je een mail? Neem dan
              contact op met je leidinggevende.
            </p>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <button
                type="button"
                onClick={() => router.push("/sign-in")}
                className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
              >
                Naar beheerlogin
              </button>

              <button
                type="button"
                onClick={() => router.push("/")}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Terug naar start
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}