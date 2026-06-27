import Link from "next/link";

export default async function Page() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto flex min-h-[70vh] max-w-xl items-center">
        <section className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <p className="text-sm font-medium text-blue-700">
              IJssalon Vincenzo
            </p>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Deze instructielink wordt niet meer gebruikt
            </h1>

            <p className="text-sm leading-6 text-slate-600">
              Werkinstructies worden tegenwoordig per mail verstuurd via een
              persoonlijke link. Daardoor heb je geen account of wachtwoord meer
              nodig.
            </p>

            <p className="text-sm leading-6 text-slate-600">
              Open de instructie via de link in je instructiemail. Mis je die
              mail of werkt de link niet? Neem dan contact op met je
              leidinggevende.
            </p>

            <div className="flex flex-col gap-3 pt-2 sm:flex-row">
              <Link
                href="/sign-in"
                className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
              >
                Naar beheerlogin
              </Link>

              <Link
                href="/"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Terug naar start
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}