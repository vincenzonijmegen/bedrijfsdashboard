// src/app/admin/kasstaten/page.tsx
"use client";

import { useEffect, useState } from "react";
import { addDays, format, parseISO } from "date-fns";
import { v4 as uuidv4 } from "uuid";
import useSWR from "swr";

interface Kasstaat {
  id?: string;
  datum: string;
  contant: number;
  pin: number;
  bon: number;
  cadeaubon: number;
  opmerking: string;
  totaal: number;
}

interface KasboekAdviesResponse {
  datum: string;
  kassa: {
    contant: number;
    pin: number;
    cadeaubon: number;
    totaal: number;
    bonnenVerkocht: number;
  };
  kasboekadvies: {
    verkopenLaag: number;
    verkopenHoog: number;
    verkoopCadeaubonnen: number;
    ingenomenCadeaubon: number;
  };
  onbekendeProducten: string[];
  waarschuwingen: string[];
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const euro = (value: number) =>
  `€ ${Number(value || 0).toLocaleString("nl-NL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const numberInputValue = (value: number | undefined) =>
  value === 0 || value == null ? "" : value;

const parseInput = (value: string) =>
  parseFloat(value.replace(",", ".")) || 0;

export default function KasstatenPage() {
  const [datum, setDatum] = useState(format(new Date(), "yyyy-MM-dd"));
  const [kasstaat, setKasstaat] = useState<Kasstaat | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const formatDMY = (iso: string) => {
    const d = new Date(iso);
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const yyyy = d.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  };

  const { data: kassadata } = useSWR(
    () =>
      datum
        ? `/api/kassa/omzet?start=${formatDMY(datum)}&totalen=1`
        : null,
    fetcher
  );

  const {
    data: kasboekAdviesData,
    error: kasboekAdviesError,
    isLoading: kasboekAdviesLoading,
  } = useSWR<KasboekAdviesResponse>(
    () => (datum ? `/api/kassa/kasboekadvies?start=${formatDMY(datum)}` : null),
    fetcher
  );

  const record = Array.isArray(kassadata)
    ? (kassadata[0] as Record<string, string>)
    : null;

  const kassaContant = record ? parseFloat(record.Cash) || 0 : 0;
  const kassaPin = record ? parseFloat(record.Pin) || 0 : 0;
  const kassaBon = record ? parseFloat(record.Bon) || 0 : 0;
  const kassaIsvoucher = record ? parseFloat(record.isvoucher) || 0 : 0;
  const kassaTotaal = kassaContant + kassaPin + kassaBon;

  const advies = kasboekAdviesData?.kasboekadvies;
  const onbekendeProducten = kasboekAdviesData?.onbekendeProducten ?? [];
  const waarschuwingen = kasboekAdviesData?.waarschuwingen ?? [];

  useEffect(() => {
    fetchData();
  }, [datum]);

  async function fetchData() {
    setLoading(true);

    const res = await fetch(`/api/kasstaten?datum=${datum}`);

    if (!res.ok) {
      setKasstaat(null);
      setLoading(false);
      return;
    }

    const json = await res.json();

    if (json === null) {
      setKasstaat({
        id: uuidv4(),
        bon: kassaIsvoucher,
        cadeaubon: kassaBon,
        datum,
        contant: 0,
        pin: 0,
        opmerking: "",
        totaal: 0,
      });
    } else {
      setKasstaat(json);
    }

    setLoading(false);
  }

  function wijzigDatum(dagen: number) {
    const nieuweDatum = format(addDays(parseISO(datum), dagen), "yyyy-MM-dd");
    setDatum(nieuweDatum);
  }

  function updateField(field: keyof Kasstaat, value: any) {
    setKasstaat((prev) => (prev ? { ...prev, [field]: value } : null));
  }

  async function bestaatKasstaat(datum: string): Promise<boolean> {
    const res = await fetch(`/api/kasstaten?datum=${datum}`);
    if (!res.ok) return false;
    const data = await res.json();
    return !!data;
  }

  async function opslaan() {
    if (!kasstaat) return;

    const bestaat = await bestaatKasstaat(kasstaat.datum);
    const method = bestaat ? "PUT" : "POST";

    const roundedKasstaat = {
      ...kasstaat,
      contant: parseFloat(Number(kasstaat.contant).toFixed(2)),
      pin: parseFloat(Number(kasstaat.pin).toFixed(2)),
      bon: parseFloat(Number(kasstaat.bon).toFixed(2)),
      cadeaubon: parseFloat(Number(kasstaat.cadeaubon).toFixed(2)),
    };

    const res = await fetch("/api/kasstaten", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...roundedKasstaat, datum }),
    });

    const json = await res.json();

    setMessage("Opgeslagen");
    setTimeout(() => setMessage(null), 3000);
    setKasstaat(json);
  }

  async function verwijderen() {
    if (!confirm("Weet je zeker dat je deze kasstaat wilt verwijderen?")) {
      return;
    }

    await fetch(`/api/kasstaten?datum=${datum}`, { method: "DELETE" });

    setMessage("Verwijderd");
    setKasstaat(null);
    setTimeout(() => setMessage(null), 3000);
  }

  const verschil = (geteld: number, kassa: number) => geteld - kassa;

  const verschilClass = (waarde: number) => {
    if (waarde > 0) return "text-emerald-700";
    if (waarde < 0) return "text-red-600";
    return "text-slate-700";
  };

  const totaalGeteld =
    Number(kasstaat?.contant ?? 0) +
    Number(kasstaat?.pin ?? 0) +
    Number(kasstaat?.cadeaubon ?? 0);

  const totaalVerschil = verschil(totaalGeteld, kassaTotaal);

  return (
    <main className="min-h-screen bg-slate-100 p-4 sm:p-6">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-sm font-medium text-blue-600">
              Import / Invoer / Kasstaat invullen
            </div>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">
              Dagomzet
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => wijzigDatum(-1)}
              className="h-10 rounded-xl bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
            >
              ◀
            </button>

            <input
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
            />

            <button
              onClick={() => wijzigDatum(1)}
              className="h-10 rounded-xl bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
            >
              ▶
            </button>
          </div>
        </div>

        {loading && (
          <p className="rounded-xl bg-white px-4 py-3 text-sm text-slate-500 shadow-sm ring-1 ring-slate-200">
            Kasstaat wordt geladen...
          </p>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-950">Kascontrole</h2>
            <p className="mt-1 text-xs text-slate-500">
              Vul de getelde bedragen in en vergelijk ze met de kassatotalen.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            <KasControleRow
              label="Contant"
              value={numberInputValue(kasstaat?.contant)}
              onChange={(value) => updateField("contant", parseInput(value))}
              kassa={kassaContant}
              verschil={verschil(kasstaat?.contant ?? 0, kassaContant)}
              verschilClass={verschilClass}
            />

            <KasControleRow
              label="Pin"
              value={numberInputValue(kasstaat?.pin)}
              onChange={(value) => updateField("pin", parseInput(value))}
              kassa={kassaPin}
              verschil={verschil(kasstaat?.pin ?? 0, kassaPin)}
              verschilClass={verschilClass}
            />

            <KasControleRow
              label="Cadeaubon"
              value={numberInputValue(kasstaat?.cadeaubon)}
              onChange={(value) =>
                updateField("cadeaubon", parseInput(value))
              }
              kassa={kassaBon}
              verschil={verschil(kasstaat?.cadeaubon ?? 0, kassaBon)}
              verschilClass={verschilClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:grid-cols-3">
            <SummaryCard label="Geteld totaal" value={euro(totaalGeteld)} />
            <SummaryCard label="Kassa totaal" value={euro(kassaTotaal)} />
            <SummaryCard
              label="Verschil"
              value={euro(totaalVerschil)}
              valueClass={verschilClass(totaalVerschil)}
            />
          </div>

          <div className="space-y-3 border-t border-slate-100 px-5 py-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[170px_1fr_150px_150px] md:items-center">
              <div>
                <div className="font-medium text-slate-950">
                  Bonnen verkocht
                </div>
                <div className="text-xs text-slate-500">
                  Verkoop cadeaubonnen
                </div>
              </div>

              <input
                type="number"
                step="0.01"
                inputMode="decimal"
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-right text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                value={numberInputValue(kasstaat?.bon)}
                onChange={(e) => updateField("bon", parseInput(e.target.value))}
              />

              <div className="rounded-xl bg-slate-50 px-3 py-2 text-right text-sm text-slate-700 ring-1 ring-slate-200">
                {euro(kassaIsvoucher)}
              </div>

              <div
                className={`rounded-xl px-3 py-2 text-right text-sm font-semibold ring-1 ${
                  verschil(kasstaat?.bon ?? 0, kassaIsvoucher) === 0
                    ? "bg-slate-50 text-slate-700 ring-slate-200"
                    : "bg-red-50 text-red-700 ring-red-100"
                }`}
              >
                {euro(verschil(kasstaat?.bon ?? 0, kassaIsvoucher))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-[170px_1fr] md:items-center">
              <label className="font-medium text-slate-950">Opmerking</label>
              <input
                type="text"
                className="h-10 w-full rounded-xl border border-slate-200 px-3 text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                value={kasstaat?.opmerking ?? ""}
                onChange={(e) => updateField("opmerking", e.target.value)}
              />
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm shadow-sm">
          <div className="mb-4">
            <h2 className="font-bold text-blue-950">Kasboekadvies</h2>
            <p className="mt-1 text-xs text-blue-800">
              Te gebruiken bij het invullen van het kasboek. Pinomzet blijft
              buiten dit advies.
            </p>
          </div>

          {kasboekAdviesLoading && (
            <p className="text-blue-800">Kasboekadvies wordt opgehaald...</p>
          )}

          {kasboekAdviesError && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-red-700 ring-1 ring-red-200">
              Kasboekadvies kon niet worden opgehaald.
            </p>
          )}

          {!kasboekAdviesLoading && !kasboekAdviesError && advies && (
            <div className="space-y-2">
              <AdviesRow label="Verkopen laag 9%" value={advies.verkopenLaag} />
              <AdviesRow label="Verkopen hoog 21%" value={advies.verkopenHoog} />
              <AdviesRow
                label="Verkoop cadeaubonnen"
                value={advies.verkoopCadeaubonnen}
              />
              <AdviesRow
                label="Ingenomen cadeaubon"
                value={advies.ingenomenCadeaubon}
              />

              {waarschuwingen.length > 0 && (
                <AlertBlock title="Waarschuwing" items={waarschuwingen} />
              )}

              {onbekendeProducten.length > 0 && (
                <AlertBlock title="Onbekende producten" items={onbekendeProducten} />
              )}
            </div>
          )}
        </section>

        <div className="flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            onClick={opslaan}
            className="h-11 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
          >
            Opslaan
          </button>

          {kasstaat?.id && (
            <button
              type="button"
              onClick={verwijderen}
              className="h-11 rounded-xl bg-red-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
            >
              Verwijderen
            </button>
          )}
        </div>

        {message && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800 ring-1 ring-emerald-100">
            {message}
          </p>
        )}
      </div>
    </main>
  );
}

function KasControleRow({
  label,
  value,
  onChange,
  kassa,
  verschil,
  verschilClass,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  kassa: number;
  verschil: number;
  verschilClass: (waarde: number) => string;
}) {
  const isOk = verschil === 0;

  return (
    <div className="grid grid-cols-1 gap-3 px-5 py-4 md:grid-cols-[170px_1fr_150px_150px] md:items-center">
      <div>
        <div className="font-medium text-slate-950">{label}</div>
        <div className="text-xs text-slate-500">Geteld tegenover kassa</div>
      </div>

      <input
        type="number"
        step="0.01"
        inputMode="decimal"
        className="h-10 w-full rounded-xl border border-slate-200 px-3 text-right text-sm outline-none focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />

      <div className="rounded-xl bg-slate-50 px-3 py-2 text-right text-sm text-slate-700 ring-1 ring-slate-200">
        {euro(kassa)}
      </div>

      <div
        className={`rounded-xl px-3 py-2 text-right text-sm font-semibold ring-1 ${
          isOk
            ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
            : "bg-red-50 text-red-700 ring-red-100"
        }`}
      >
        {euro(verschil)}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  valueClass = "text-slate-950",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="rounded-xl bg-white px-4 py-3 shadow-sm ring-1 ring-slate-200">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-bold tabular-nums ${valueClass}`}>
        {value}
      </div>
    </div>
  );
}

function AdviesRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-4 rounded-xl bg-white/70 px-3 py-2 ring-1 ring-blue-100">
      <span className="text-blue-950">{label}</span>
      <span className="font-semibold tabular-nums text-blue-950">
        {euro(value)}
      </span>
    </div>
  );
}

function AlertBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
      <div className="font-bold">{title}</div>
      <ul className="mt-1 list-disc pl-4">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}