import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";

const tegels = [
  {
    titel: "Invoer jaarrekeningen",
    beschrijving: "Beheer W&V, balans activa en balans passiva per jaar.",
    link: "/admin/rapportage/jaarrekeningen",
  },
  {
    titel: "Rapport per jaar",
    beschrijving: "Bekijk één jaar volledig met totalen, winst en balanscontrole.",
    link: "/admin/rapportage/jaarrekeningen/rapport",
  },
  {
    titel: "Meerjarenrapport",
    beschrijving:
      "Bekijk alle jaren naast elkaar per hoofdrubriek, uitklapbaar naar regels.",
    link: "/admin/rapportage/jaarrekeningen/meerjaren",
  },
  {
    titel: "Grafieken jaarrekeningen",
    beschrijving: "Analyseer omzet, kosten, winst en kostenstructuur visueel.",
    link: "/admin/rapportage/jaarrekeningen/grafieken",
  },
  {
    titel: "Prognose jaarrekeningen",
    beschrijving: "Maak vooruitblik op omzet, kosten, winst en balansontwikkeling.",
    link: "/admin/rapportage/jaarrekeningen/prognose",
  },
];

export default function JaarrekeningenOverzichtPage() {
  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Link
            href="/admin/rapportage/financieel"
            className="text-sm text-blue-700 hover:underline"
          >
            ← Terug naar financiële rapportages
          </Link>

          <div className="mt-3">
            <h1 className="text-2xl font-bold text-slate-900">
              Jaarrekeningen
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Invoer, rapporten, meerjarenoverzicht, grafieken en prognoses.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tegels.map((r) => (
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