"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Onderdeel = {
  id: number;
  code: "winst_en_verlies" | "balans_activa" | "balans_passiva";
  naam: string;
};

type Rubriek = {
  id: number;
  onderdeel_id: number;
  naam: string;
};

type Regel = {
  id: number;
  rubriek_id: number;
  naam: string;
  is_totaal: boolean;
  bedragen: Record<string, string | number | null>;
};

export default function JaarrekeningenPage() {
  const { data, mutate, error } = useSWR("/api/admin/jaarrekeningen", fetcher);

  const [onderdeelCode, setOnderdeelCode] =
    useState<Onderdeel["code"]>("winst_en_verlies");

  const [nieuwJaar, setNieuwJaar] = useState("");

  const [nieuweRubriek, setNieuweRubriek] = useState({
    naam: "",
    sortering: 0,
  });

  const [nieuweRegel, setNieuweRegel] = useState({
    rubriek_id: "",
    naam: "",
    sortering: 0,
    is_totaal: false,
  });

  const onderdelen: Onderdeel[] = data?.onderdelen || [];
  const rubrieken: Rubriek[] = data?.rubrieken || [];
  const regels: Regel[] = data?.regels || [];

  const actiefOnderdeel = onderdelen.find((o) => o.code === onderdeelCode);

  const zichtbareRubrieken = useMemo(() => {
    if (!actiefOnderdeel) return [];
    return rubrieken.filter((r) => r.onderdeel_id === actiefOnderdeel.id);
  }, [rubrieken, actiefOnderdeel]);

  const jaren = useMemo(() => {
    const basis = data?.jaren?.length ? data.jaren : [];
    const extra = nieuwJaar ? [Number(nieuwJaar)] : [];
    return Array.from(new Set([...basis, ...extra]))
      .filter(Boolean)
      .sort((a, b) => a - b);
  }, [data, nieuwJaar]);

  async function slaBedragOp(regelId: number, jaar: number, bedrag: string) {
    await fetch("/api/admin/jaarrekeningen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actie: "bedrag_opslaan",
        regel_id: regelId,
        jaar,
        bedrag,
      }),
    });

    mutate();
  }

  async function voegRubriekToe() {
    if (!actiefOnderdeel || !nieuweRubriek.naam.trim()) return;

    await fetch("/api/admin/jaarrekeningen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actie: "rubriek_toevoegen",
        onderdeel_id: actiefOnderdeel.id,
        naam: nieuweRubriek.naam,
        sortering: nieuweRubriek.sortering,
      }),
    });

    setNieuweRubriek({ naam: "", sortering: 0 });
    mutate();
  }

  async function voegRegelToe() {
    if (!nieuweRegel.rubriek_id || !nieuweRegel.naam.trim()) return;

    await fetch("/api/admin/jaarrekeningen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        actie: "regel_toevoegen",
        rubriek_id: Number(nieuweRegel.rubriek_id),
        naam: nieuweRegel.naam,
        sortering: nieuweRegel.sortering,
        is_totaal: nieuweRegel.is_totaal,
      }),
    });

    setNieuweRegel({
      rubriek_id: "",
      naam: "",
      sortering: 0,
      is_totaal: false,
    });

    mutate();
  }

  if (error) return <div className="p-6 text-red-600">Fout bij laden.</div>;
  if (!data) return <div className="p-6">Laden...</div>;

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <Link
            href="/admin/rapportage"
            className="text-sm text-blue-700 hover:underline"
          >
            ← Terug naar rapportage
          </Link>

          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Jaarrekeningen
              </h1>
              <p className="text-sm text-slate-500">
                Beheer W&V, balans activa en balans passiva per jaar.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {onderdelen.map((onderdeel) => (
                <button
                  key={onderdeel.id}
                  onClick={() => setOnderdeelCode(onderdeel.code)}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                    onderdeelCode === onderdeel.code
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                  }`}
                >
                  {onderdeel.naam}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <label className="text-sm font-semibold text-slate-700">
            Nieuw jaar tonen/toevoegen
          </label>
          <input
            value={nieuwJaar}
            onChange={(e) => setNieuwJaar(e.target.value)}
            placeholder="bijv. 2020"
            className="mt-2 w-40 rounded-xl border border-slate-300 px-3 py-2 text-sm"
          />
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-200">
              <tr>
                <th className="sticky left-0 z-10 bg-slate-200 px-3 py-2 text-left">
                  Rubriek / regel
                </th>
                {jaren.map((jaar: number) => (
                  <th key={jaar} className="px-3 py-2 text-right">
                    {jaar}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {zichtbareRubrieken.map((rubriek) => {
                const regelsVanRubriek = regels.filter(
                  (r) => r.rubriek_id === rubriek.id
                );

                return (
                  <>
                    <tr key={`rubriek-${rubriek.id}`} className="bg-slate-50">
                      <td
                        colSpan={jaren.length + 1}
                        className="sticky left-0 px-3 py-3 text-sm font-bold text-slate-900"
                      >
                        {rubriek.naam}
                      </td>
                    </tr>

                    {regelsVanRubriek.map((regel) => (
                      <tr key={regel.id} className="border-t border-slate-200">
                        <td
                          className={`sticky left-0 bg-white px-3 py-2 ${
                            regel.is_totaal
                              ? "font-bold text-slate-900"
                              : "text-slate-700"
                          }`}
                        >
                          {regel.naam}
                        </td>

                        {jaren.map((jaar: number) => (
                          <td key={jaar} className="px-3 py-2 text-right">
                            <input
                              defaultValue={regel.bedragen?.[jaar] ?? ""}
                              onBlur={(e) =>
                                slaBedragOp(regel.id, jaar, e.target.value)
                              }
                              className={`w-28 rounded-lg border border-slate-300 px-2 py-1 text-right ${
                                regel.is_totaal ? "font-bold" : ""
                              }`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-slate-900">
              Rubriek toevoegen
            </h2>

            <div className="grid gap-3">
              <input
                value={nieuweRubriek.naam}
                onChange={(e) =>
                  setNieuweRubriek({ ...nieuweRubriek, naam: e.target.value })
                }
                placeholder="Bijv. Omzet, Afschrijvingen, Vaste activa"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />

              <input
                type="number"
                value={nieuweRubriek.sortering}
                onChange={(e) =>
                  setNieuweRubriek({
                    ...nieuweRubriek,
                    sortering: Number(e.target.value),
                  })
                }
                placeholder="Sortering"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <button
              onClick={voegRubriekToe}
              className="mt-4 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Rubriek toevoegen
            </button>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-slate-900">
              Regel toevoegen
            </h2>

            <div className="grid gap-3">
              <select
                value={nieuweRegel.rubriek_id}
                onChange={(e) =>
                  setNieuweRegel({
                    ...nieuweRegel,
                    rubriek_id: e.target.value,
                  })
                }
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Kies rubriek</option>
                {zichtbareRubrieken.map((rubriek) => (
                  <option key={rubriek.id} value={rubriek.id}>
                    {rubriek.naam}
                  </option>
                ))}
              </select>

              <input
                value={nieuweRegel.naam}
                onChange={(e) =>
                  setNieuweRegel({ ...nieuweRegel, naam: e.target.value })
                }
                placeholder="Bijv. Omzet laag, Huur, Inventaris"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />

              <input
                type="number"
                value={nieuweRegel.sortering}
                onChange={(e) =>
                  setNieuweRegel({
                    ...nieuweRegel,
                    sortering: Number(e.target.value),
                  })
                }
                placeholder="Sortering"
                className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={nieuweRegel.is_totaal}
                  onChange={(e) =>
                    setNieuweRegel({
                      ...nieuweRegel,
                      is_totaal: e.target.checked,
                    })
                  }
                />
                Dit is een totaalregel
              </label>
            </div>

            <button
              onClick={voegRegelToe}
              className="mt-4 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Regel toevoegen
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}