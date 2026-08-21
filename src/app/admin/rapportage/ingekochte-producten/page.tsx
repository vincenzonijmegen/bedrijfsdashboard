"use client";

import { useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart2,
  CalendarDays,
  Filter,
  List,
  Loader2,
  Package,
  Truck,
} from "lucide-react";

type Weergave = "producten" | "leveranciers" | "maanden" | "details";
type Periode = "dit_jaar" | "dit_seizoen" | "alles" | "aangepast";

type LeverancierOptie = {
  id: number;
  naam: string;
  soort?: string | null;
};

type ProductOptie = {
  id: number;
  naam: string;
  leverancierId: number;
  leverancierNaam: string | null;
  bestelnummer: string | null;
  actief: boolean;
};

type ProductTotaal = {
  leverancierId: number;
  leverancierNaam: string;
  productId: number | null;
  productSleutel: string;
  productNaam: string;
  bestelnummer: string | null;
  aantalBestellingen: number;
  totaalAantal: number;
};

type LeverancierTotaal = {
  leverancierId: number;
  leverancierNaam: string;
  aantalBestellingen: number;
  aantalProducten: number;
  aantalRegels: number;
};

type MaandTotaal = {
  maand: string;
  aantalBestellingen: number;
  aantalLeveranciers: number;
  aantalProducten: number;
  aantalRegels: number;
};

type Bestelregel = {
  bestellingId: number;
  besteldOp: string;
  referentie: string;
  leverancierId: number;
  leverancierNaam: string;
  productId: number | null;
  productSleutel: string;
  productNaam: string;
  bestelnummer: string | null;
  aantal: number;
};

type RapportageData = {
  success: boolean;
  filters: {
    van: string | null;
    tot: string | null;
    leverancierId: number | null;
    productId: number | null;
  };
  samenvatting: {
    aantalBestellingen: number;
    aantalLeveranciers: number;
    aantalProducten: number;
    aantalRegels: number;
  };
  perProduct: ProductTotaal[];
  perLeverancier: LeverancierTotaal[];
  perMaand: MaandTotaal[];
  regels: Bestelregel[];
  opties: {
    leveranciers: LeverancierOptie[];
    producten: ProductOptie[];
  };
};

const fetcher = async (url: string) => {
  const response = await fetch(url, { cache: "no-store" });
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(data?.error || "Rapportage kon niet worden geladen");
  }

  return data;
};

function lokaleIsoDatum(datum: Date) {
  const jaar = datum.getFullYear();
  const maand = String(datum.getMonth() + 1).padStart(2, "0");
  const dag = String(datum.getDate()).padStart(2, "0");
  return `${jaar}-${maand}-${dag}`;
}

const vandaagIso = () => lokaleIsoDatum(new Date());
const jaarStartIso = () => `${new Date().getFullYear()}-01-01`;
const seizoenStartIso = () => `${new Date().getFullYear()}-03-01`;

const formatAantal = (value: number) =>
  Number(value || 0).toLocaleString("nl-NL", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const formatDatum = (value: string) => {
  const [jaar, maand, dag] = value.split("-").map(Number);
  return new Date(jaar, maand - 1, dag).toLocaleDateString("nl-NL");
};

const formatMaand = (value: string) => {
  const [jaar, maand] = value.split("-").map(Number);
  return new Date(jaar, maand - 1, 1).toLocaleDateString("nl-NL", {
    month: "long",
    year: "numeric",
  });
};

const tabs: Array<{ id: Weergave; label: string }> = [
  { id: "producten", label: "Per product" },
  { id: "leveranciers", label: "Per leverancier" },
  { id: "maanden", label: "Per maand" },
  { id: "details", label: "Bestelregels" },
];

export default function IngekochteProductenPage() {
  const [periode, setPeriode] = useState<Periode>("dit_jaar");
  const [van, setVan] = useState(jaarStartIso());
  const [tot, setTot] = useState(vandaagIso());
  const [leverancier, setLeverancier] = useState("");
  const [product, setProduct] = useState("");
  const [weergave, setWeergave] = useState<Weergave>("producten");

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (van) params.set("van", van);
    if (tot) params.set("tot", tot);
    if (leverancier) params.set("leverancier", leverancier);
    if (product) params.set("product", product);
    return params.toString();
  }, [van, tot, leverancier, product]);

  const { data, error, isLoading } = useSWR<RapportageData>(
    `/api/rapportage/ingekochte-producten${query ? `?${query}` : ""}`,
    fetcher,
    { keepPreviousData: true }
  );

  const productOpties = useMemo(() => {
    const alleProducten = data?.opties.producten ?? [];
    const gefilterd = leverancier
      ? alleProducten.filter(
          (item) => item.leverancierId === Number(leverancier)
        )
      : alleProducten;

    return [...gefilterd].sort(
      (a, b) =>
        String(a.leverancierNaam || "").localeCompare(
          String(b.leverancierNaam || ""),
          "nl"
        ) || a.naam.localeCompare(b.naam, "nl")
    );
  }, [data?.opties.producten, leverancier]);

  const wijzigPeriode = (nieuwePeriode: Periode) => {
    setPeriode(nieuwePeriode);

    if (nieuwePeriode === "dit_jaar") {
      setVan(jaarStartIso());
      setTot(vandaagIso());
    } else if (nieuwePeriode === "dit_seizoen") {
      setVan(seizoenStartIso());
      setTot(vandaagIso());
    } else if (nieuwePeriode === "alles") {
      setVan("");
      setTot("");
    }
  };

  const wijzigLeverancier = (waarde: string) => {
    setLeverancier(waarde);

    if (!product || !waarde) return;

    const gekozenProduct = data?.opties.producten.find(
      (item) => item.id === Number(product)
    );

    if (gekozenProduct?.leverancierId !== Number(waarde)) {
      setProduct("");
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Link
            href="/admin"
            className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            <ArrowLeft className="h-4 w-4" />
            Terug naar beheer
          </Link>

          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-pink-50 p-2.5 text-pink-700">
              <BarChart2 className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Ingekochte producten
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Bekijk opgeslagen bestellingen per product, leverancier en
                periode.
              </p>
            </div>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Filter className="h-5 w-5 text-slate-500" />
            <h2 className="font-bold text-slate-900">Filters</h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            <label className="space-y-1 text-sm font-medium text-slate-700">
              Periode
              <select
                value={periode}
                onChange={(event) =>
                  wijzigPeriode(event.target.value as Periode)
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="dit_jaar">Dit jaar</option>
                <option value="dit_seizoen">Dit seizoen vanaf 1 maart</option>
                <option value="alles">Alle bestellingen</option>
                <option value="aangepast">Aangepaste periode</option>
              </select>
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              Van
              <input
                type="date"
                value={van}
                onChange={(event) => {
                  setPeriode("aangepast");
                  setVan(event.target.value);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              Tot en met
              <input
                type="date"
                value={tot}
                onChange={(event) => {
                  setPeriode("aangepast");
                  setTot(event.target.value);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              Leverancier
              <select
                value={leverancier}
                onChange={(event) => wijzigLeverancier(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Alle leveranciers</option>
                {(data?.opties.leveranciers ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.naam}
                  </option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm font-medium text-slate-700">
              Product
              <select
                value={product}
                onChange={(event) => setProduct(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                <option value="">Alle producten</option>
                {productOpties.map((item) => (
                  <option key={item.id} value={item.id}>
                    {!leverancier && item.leverancierNaam
                      ? `${item.leverancierNaam} – `
                      : ""}
                    {item.naam}
                    {!item.actief ? " (inactief)" : ""}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        {error && (
          <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <div className="font-semibold">Rapportage kon niet worden geladen</div>
              <div>{error.message}</div>
            </div>
          </div>
        )}

        {isLoading && !data && (
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
            <Loader2 className="h-5 w-5 animate-spin" />
            Rapportage wordt geladen...
          </div>
        )}

        {data?.success && (
          <>
            <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <SamenvattingCard
                label="Bestellingen"
                waarde={data.samenvatting.aantalBestellingen}
                icon={<List className="h-5 w-5" />}
              />
              <SamenvattingCard
                label="Leveranciers"
                waarde={data.samenvatting.aantalLeveranciers}
                icon={<Truck className="h-5 w-5" />}
              />
              <SamenvattingCard
                label="Producten"
                waarde={data.samenvatting.aantalProducten}
                icon={<Package className="h-5 w-5" />}
              />
              <SamenvattingCard
                label="Bestelregels"
                waarde={data.samenvatting.aantalRegels}
                icon={<CalendarDays className="h-5 w-5" />}
              />
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap gap-2 border-b border-slate-200 p-4">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setWeergave(tab.id)}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                      weergave === tab.id
                        ? "bg-pink-600 text-white"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {data.samenvatting.aantalRegels === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">
                  Geen ingekochte producten gevonden binnen deze selectie.
                </div>
              ) : (
                <>
                  {weergave === "producten" && (
                    <ProductTabel regels={data.perProduct} />
                  )}
                  {weergave === "leveranciers" && (
                    <LeverancierTabel regels={data.perLeverancier} />
                  )}
                  {weergave === "maanden" && (
                    <MaandTabel regels={data.perMaand} />
                  )}
                  {weergave === "details" && (
                    <DetailTabel regels={data.regels} />
                  )}
                </>
              )}
            </section>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
              De aantallen en besteldatums komen rechtstreeks uit de opgeslagen
              bestellingen. Historische prijzen worden niet berekend, omdat de
              prijs op het moment van bestellen niet in de bestelhistorie wordt
              vastgelegd.
            </div>
          </>
        )}
      </div>
    </main>
  );
}

function SamenvattingCard({
  label,
  waarde,
  icon,
}: {
  label: string;
  waarde: number;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-2 text-2xl font-bold text-slate-900 md:text-3xl">
        {formatAantal(waarde)}
      </div>
    </div>
  );
}

function ProductTabel({ regels }: { regels: ProductTotaal[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Leverancier</th>
            <th className="px-4 py-3">Product</th>
            <th className="px-4 py-3">Bestelnummer</th>
            <th className="px-4 py-3 text-right">Bestellingen</th>
            <th className="px-4 py-3 text-right">Aantal besteld</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {regels.map((regel) => (
            <tr
              key={`${regel.leverancierId}:${
                regel.productId ?? regel.productSleutel
              }`}
              className="hover:bg-slate-50"
            >
              <td className="px-4 py-2 text-slate-600">
                {regel.leverancierNaam}
              </td>
              <td className="px-4 py-2 font-medium text-slate-900">
                {regel.productNaam}
              </td>
              <td className="px-4 py-2 text-slate-500">
                {regel.bestelnummer || "–"}
              </td>
              <td className="px-4 py-2 text-right text-slate-700">
                {formatAantal(regel.aantalBestellingen)}
              </td>
              <td className="px-4 py-2 text-right font-semibold text-slate-900">
                {formatAantal(regel.totaalAantal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LeverancierTabel({ regels }: { regels: LeverancierTotaal[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Leverancier</th>
            <th className="px-4 py-3 text-right">Bestellingen</th>
            <th className="px-4 py-3 text-right">Producten</th>
            <th className="px-4 py-3 text-right">Bestelregels</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {regels.map((regel) => (
            <tr key={regel.leverancierId} className="hover:bg-slate-50">
              <td className="px-4 py-2 font-medium text-slate-900">
                {regel.leverancierNaam}
              </td>
              <td className="px-4 py-2 text-right text-slate-700">
                {formatAantal(regel.aantalBestellingen)}
              </td>
              <td className="px-4 py-2 text-right text-slate-700">
                {formatAantal(regel.aantalProducten)}
              </td>
              <td className="px-4 py-2 text-right text-slate-700">
                {formatAantal(regel.aantalRegels)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MaandTabel({ regels }: { regels: MaandTotaal[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Maand</th>
            <th className="px-4 py-3 text-right">Bestellingen</th>
            <th className="px-4 py-3 text-right">Leveranciers</th>
            <th className="px-4 py-3 text-right">Producten</th>
            <th className="px-4 py-3 text-right">Bestelregels</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {regels.map((regel) => (
            <tr key={regel.maand} className="hover:bg-slate-50">
              <td className="px-4 py-2 font-medium capitalize text-slate-900">
                {formatMaand(regel.maand)}
              </td>
              <td className="px-4 py-2 text-right text-slate-700">
                {formatAantal(regel.aantalBestellingen)}
              </td>
              <td className="px-4 py-2 text-right text-slate-700">
                {formatAantal(regel.aantalLeveranciers)}
              </td>
              <td className="px-4 py-2 text-right text-slate-700">
                {formatAantal(regel.aantalProducten)}
              </td>
              <td className="px-4 py-2 text-right text-slate-700">
                {formatAantal(regel.aantalRegels)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DetailTabel({ regels }: { regels: Bestelregel[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Datum</th>
            <th className="px-4 py-3">Referentie</th>
            <th className="px-4 py-3">Leverancier</th>
            <th className="px-4 py-3">Product</th>
            <th className="px-4 py-3">Bestelnummer</th>
            <th className="px-4 py-3 text-right">Aantal</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {regels.map((regel, index) => (
            <tr
              key={`${regel.bestellingId}:${
                regel.productId ?? regel.productSleutel
              }:${index}`}
              className="hover:bg-slate-50"
            >
              <td className="whitespace-nowrap px-4 py-2 text-slate-600">
                {formatDatum(regel.besteldOp)}
              </td>
              <td className="whitespace-nowrap px-4 py-2 text-slate-500">
                {regel.referentie}
              </td>
              <td className="px-4 py-2 text-slate-600">
                {regel.leverancierNaam}
              </td>
              <td className="px-4 py-2 font-medium text-slate-900">
                {regel.productNaam}
              </td>
              <td className="px-4 py-2 text-slate-500">
                {regel.bestelnummer || "–"}
              </td>
              <td className="px-4 py-2 text-right font-semibold text-slate-900">
                {formatAantal(regel.aantal)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
