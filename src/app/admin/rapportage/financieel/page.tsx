// Bestand: src/app/admin/rapportage/financieel/page.tsx

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

const rapportages = [
  {
    titel: "Jaarrekeningen",
    beschrijving: "Invoer, rapporten, meerjarenoverzicht, grafieken en prognoses.",
    link: "/admin/rapportage/jaarrekeningen/overzicht",
  },
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

export default function RapportageOverzicht() {
  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">
            Financiële Rapportages Vincenzo
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Omzetrapportages, jaarrekeningen, kasboek en journaalposten.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {rapportages.map((r) => (
            <Link href={r.link} key={r.titel}>
              <Card className="h-full cursor-pointer rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                <CardContent className="p-5">
                  <h2 className="mb-1 text-lg font-semibold text-slate-900">
                    {r.titel}
                  </h2>
                  <p className="text-sm leading-5 text-slate-600">
                    {r.beschrijving}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}