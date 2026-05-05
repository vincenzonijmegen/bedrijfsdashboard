// Bestand: src/app/admin/rapportage/financieel/page.tsx

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

const rapportages = [
  {
    titel: "Omzetprognose",
    beschrijving: "Toon omzetprognose o.b.v. historie en groei",
    link: "/admin/omzet/prognose",
  },
  {
    titel: "Maandomzet per jaar",
    beschrijving: "Toon de totale omzet per maand en per jaar",
    link: "/admin/rapportage/financieel/maandomzet",
  },
  {
    titel: "Omzet per uur per dag",
    beschrijving: "Toon omzet per uur per dag op te kiezen periode",
    link: "/admin/rapportage/financieel/uuromzet",
  },
  {
    titel: "Omzet Feestdagen",
    beschrijving: "Toon omzet op feestdagen",
    link: "/admin/rapportage/financieel/feestdagomzet",
  },
  {
    titel: "Top omzetdagen",
    beschrijving: "Toon de top omzetdagen",
    link: "/admin/rapportage/financieel/top-omzetdagen",
  },
  {
    titel: "Export kasboek t.b.v. accountant",
    beschrijving: "Exporteer kasboek per jaar",
    link: "/admin/kasboek/kasstaat",
  },
  {
    titel: "Journaalpost MyPos",
    beschrijving: "Journaalpost MyPOS t.b.v. Snelstart",
    link: "/admin/mypos/boeking",
  },
];

const jaarrekeningTegels = [
  {
    titel: "Invoer jaarrekeningen",
    beschrijving: "Beheer W&V, balans activa en balans passiva per jaar.",
    link: "/admin/rapportage/jaarrekeningen",
  },
  {
    titel: "Rapport jaarrekeningen",
    beschrijving: "Bekijk jaarrekeningen overzichtelijk per jaar en onderdeel.",
    link: "/admin/rapportage/jaarrekeningen/rapport",
  },
  {
    titel: "Grafieken jaarrekeningen",
    beschrijving: "Analyseer omzet, kosten, winst, vermogen en schulden visueel.",
    link: "/admin/rapportage/jaarrekeningen/grafieken",
  },
  {
    titel: "Prognose jaarrekeningen",
    beschrijving: "Maak vooruitblik op omzet, kosten, winst en balansontwikkeling.",
    link: "/admin/rapportage/jaarrekeningen/prognose",
  },
];

export default function RapportageOverzicht() {
  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">
            Financiële Rapportages Vincenzo
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Omzetrapportages, jaarrekeningen, kasboek en journaalposten.
          </p>
        </div>

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Jaarrekeningen
            </h2>
            <p className="text-sm text-slate-500">
              Invoer, rapportage, grafieken en prognoses op basis van balans en
              winst- en verliesrekening.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {jaarrekeningTegels.map((r) => (
              <Link href={r.link} key={r.titel}>
                <Card className="h-full cursor-pointer rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="p-5">
                    <h3 className="mb-1 text-lg font-semibold text-slate-900">
                      {r.titel}
                    </h3>
                    <p className="text-sm leading-5 text-slate-600">
                      {r.beschrijving}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              Overige financiële rapportages
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {rapportages.map((r) => (
              <Link href={r.link} key={r.titel}>
                <Card className="h-full cursor-pointer rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <CardContent className="p-5">
                    <h3 className="mb-1 text-lg font-semibold text-slate-900">
                      {r.titel}
                    </h3>
                    <p className="text-sm leading-5 text-slate-600">
                      {r.beschrijving}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}