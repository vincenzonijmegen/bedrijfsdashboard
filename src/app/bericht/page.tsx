import Link from "next/link";

export default function BerichtPagina() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto flex min-h-[70vh] max-w-xl items-center">
        <section className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="space-y-4">
            <p className="text-sm font-medium text-blue-700">
              IJssalon Vincenzo
            </p>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Deze vragenpagina wordt niet meer gebruikt
            </h1>

            <p className="text-sm leading-6 text-slate-600">
              Deze oude medewerkerpagina voor vragen aan de leiding wordt niet
              meer gebruikt. Medewerkers hoeven geen account meer te gebruiken
              voor werkinstructies of communicatie via het oude portaal.
            </p>

            <p className="text-sm leading-6 text-slate-600">
              Heb je een vraag over je werk, planning, instructies of
              beschikbaarheid? Neem dan contact op met je leidinggevende via de
              gebruikelijke manier.
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