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
    () => (datum ? `/api/kassa/omzet?start=${formatDMY(datum)}&totalen=1` : null),
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
  const kassaTotaal: number = kassaContant + kassaPin + kassaBon;

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
        contant: 0.0,
        pin: 0.0,
        opmerking: "",
        totaal: 0.0,
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
    if (!confirm("Weet je zeker dat je deze kasstaat wilt verwijderen?")) return;

    await fetch(`/api/kasstaten?datum=${datum}`, { method: "DELETE" });

    setMessage("Verwijderd");
    setKasstaat(null);
    setTimeout(() => setMessage(null), 3000);
  }

  const verschil = (geteld: number, kassa: number) =>
    (geteld - kassa).toFixed(2);

  const verschilClass = (waarde: string) => {
    const nummer = parseFloat(waarde);
    if (nummer > 0) return "text-green-600";
    if (nummer < 0) return "text-red-600";
    return "";
  };

  const totaalGeteld =
    Number(kasstaat?.contant ?? 0) +
    Number(kasstaat?.pin ?? 0) +
    Number(kasstaat?.cadeaubon ?? 0);

  return (
    <div className="max-w-3xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Dagomzet</h1>

      <div className="flex items-center space-x-2 mb-4">
        <button
          onClick={() => wijzigDatum(-1)}
          className="px-2 py-1 bg-gray-200 rounded"
        >
          ◀
        </button>

        <input
          type="date"
          value={datum}
          onChange={(e) => setDatum(e.target.value)}
          className="border px-2 py-1 rounded"
        />

        <button
          onClick={() => wijzigDatum(1)}
          className="px-2 py-1 bg-gray-200 rounded"
        >
          ▶
        </button>
      </div>

      {loading && (
        <p className="mb-3 text-sm text-gray-500">Kasstaat wordt geladen...</p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm border border-gray-300">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-2 text-left">Categorie</th>
              <th className="p-2 text-right">Geteld</th>
              <th className="p-2 text-right">Kassa</th>
              <th className="p-2 text-right">Verschil</th>
            </tr>
          </thead>

          <tbody>
            <tr>
              <td className="p-2">Contant</td>
              <td className="p-2 text-right">
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  className="w-full text-right border rounded px-1"
                  value={kasstaat?.contant === 0 ? "" : kasstaat?.contant}
                  onChange={(e) =>
                    updateField(
                      "contant",
                      parseFloat(e.target.value.replace(",", ".")) || 0
                    )
                  }
                />
              </td>
              <td className="p-2 text-right">
                {Number(kassaContant).toFixed(2)}
              </td>
              <td className="p-2 text-right">
                <span
                  className={verschilClass(
                    verschil(kasstaat?.contant ?? 0, kassaContant)
                  )}
                >
                  {verschil(kasstaat?.contant ?? 0, kassaContant)}
                </span>
              </td>
            </tr>

            <tr>
              <td className="p-2">Pin</td>
              <td className="p-2 text-right">
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  className="w-full text-right border rounded px-1"
                  value={kasstaat?.pin === 0 ? "" : kasstaat?.pin}
                  onChange={(e) =>
                    updateField(
                      "pin",
                      parseFloat(e.target.value.replace(",", ".")) || 0
                    )
                  }
                />
              </td>
              <td className="p-2 text-right">{Number(kassaPin).toFixed(2)}</td>
              <td className="p-2 text-right">
                <span
                  className={verschilClass(
                    verschil(kasstaat?.pin ?? 0, kassaPin)
                  )}
                >
                  {verschil(kasstaat?.pin ?? 0, kassaPin)}
                </span>
              </td>
            </tr>

            <tr>
              <td className="p-2">Cadeaubon</td>
              <td className="p-2 text-right">
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  className="w-full text-right border rounded px-1"
                  value={
                    kasstaat?.cadeaubon === 0 ? "" : kasstaat?.cadeaubon
                  }
                  onChange={(e) =>
                    updateField(
                      "cadeaubon",
                      parseFloat(e.target.value.replace(",", ".")) || 0
                    )
                  }
                />
              </td>
              <td className="p-2 text-right">{Number(kassaBon).toFixed(2)}</td>
              <td className="p-2 text-right">
                <span
                  className={verschilClass(
                    verschil(kasstaat?.cadeaubon ?? 0, kassaBon)
                  )}
                >
                  {verschil(kasstaat?.cadeaubon ?? 0, kassaBon)}
                </span>
              </td>
            </tr>

            <tr className="font-bold border-t">
              <td className="p-2">TOTAAL</td>
              <td className="p-2 text-right">{totaalGeteld.toFixed(2)}</td>
              <td className="p-2 text-right">{kassaTotaal.toFixed(2)}</td>
              <td className="p-2 text-right">
                <span className={verschilClass(verschil(totaalGeteld, kassaTotaal))}>
                  {verschil(totaalGeteld, kassaTotaal)}
                </span>
              </td>
            </tr>

            <tr className="text-gray-600">
              <td className="p-2">Bonnen verkocht</td>
              <td className="p-2 text-right">
                <input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  className="w-full text-right border rounded px-1"
                  value={kasstaat?.bon === 0 ? "" : kasstaat?.bon}
                  onChange={(e) =>
                    updateField(
                      "bon",
                      parseFloat(e.target.value.replace(",", ".")) || 0
                    )
                  }
                />
              </td>
              <td className="p-2 text-right">
                {Number(kassaIsvoucher).toFixed(2)}
              </td>
              <td className="p-2 text-right">
                <span
                  className={verschilClass(
                    verschil(kasstaat?.bon ?? 0, kassaIsvoucher)
                  )}
                >
                  {verschil(kasstaat?.bon ?? 0, kassaIsvoucher)}
                </span>
              </td>
            </tr>

            <tr>
              <td className="p-2 align-top">Opmerking</td>
              <td colSpan={3} className="p-2">
                <input
                  type="text"
                  className="w-full border rounded px-2 py-1"
                  value={kasstaat?.opmerking}
                  onChange={(e) => updateField("opmerking", e.target.value)}
                />
              </td>
            </tr>
          </tbody>
        </table>

        <section className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="font-bold text-blue-950">Kasboekadvies</h2>
              <p className="text-xs text-blue-800">
                Te gebruiken bij het invullen van het kasboek. Pinomzet blijft
                buiten dit advies.
              </p>
            </div>
          </div>

          {kasboekAdviesLoading && (
            <p className="text-blue-800">Kasboekadvies wordt opgehaald...</p>
          )}

          {kasboekAdviesError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-red-700 ring-1 ring-red-200">
              Kasboekadvies kon niet worden opgehaald.
            </p>
          )}

          {!kasboekAdviesLoading && !kasboekAdviesError && advies && (
            <div className="space-y-1">
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
                <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
                  <div className="font-bold">Waarschuwing</div>
                  <ul className="mt-1 list-disc pl-4">
                    {waarschuwingen.map((melding) => (
                      <li key={melding}>{melding}</li>
                    ))}
                  </ul>
                </div>
              )}

              {onbekendeProducten.length > 0 && (
                <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 ring-1 ring-amber-200">
                  <div className="font-bold">Onbekende producten</div>
                  <ul className="mt-1 list-disc pl-4">
                    {onbekendeProducten.map((product) => (
                      <li key={product}>{product}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </section>

        <div className="flex space-x-2 pt-4">
          <button
            type="button"
            onClick={opslaan}
            className="bg-blue-600 text-white px-4 py-2 rounded"
          >
            Opslaan
          </button>

          {kasstaat?.id && (
            <button
              type="button"
              onClick={verwijderen}
              className="bg-red-600 text-white px-4 py-2 rounded"
            >
              Verwijderen
            </button>
          )}
        </div>

        {message && <p className="text-green-700 font-medium pt-2">{message}</p>}
      </div>
    </div>
  );
}

function AdviesRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between gap-4">
      <span>{label}</span>
      <span className="font-semibold tabular-nums text-blue-950">
        {euro(value)}
      </span>
    </div>
  );
}