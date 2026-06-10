"use client";

import useSWR, { mutate } from "swr";
import { useMemo, useState } from "react";
import {
  CalendarDays,
  Check,
  Euro,
  IceCream,
  Plus,
  Save,
  Trash2,
} from "lucide-react";

type PlanningLijstItem = {
  id: number;
  jaar: number;
  naam: string;
  start_datum: string;
  eind_datum: string;
  omzet_per_dag: string | number;
  percentage_melk: string | number;
  percentage_vruchten: string | number;
  aantal_machines: number;
  kastruimte_bakken: number;
  status: "concept" | "actief" | "afgerond";
  aantal_smaken?: number;
  totaal_bakken?: string | number;
};

type Recept = {
  id: number;
  naam: string;
  categorie?: string | null;
  hoeveelheid_mix?: string | number | null;
};

type Smaak = {
  id?: number;
  recept_id: number | null;
  recept_naam?: string | null;
  smaakcode: string;
  smaaknaam: string;
  soort: "melk" | "vrucht" | "overig";
  aantal_bakken: number;
  kleur: string;
  sortering?: number | null;
};

type DetailResponse = {
  planning: PlanningLijstItem;
  smaken: Smaak[];
};

type NieuweSmaak = {
  recept_id: number | null;
  smaakcode: string;
  smaaknaam: string;
  soort: "melk" | "vrucht" | "overig";
  aantal_bakken: number;
  kleur: string;
};

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Fout bij ophalen");
  return res.json();
};

const todayYear = new Date().getFullYear();

const legePlanning = () => ({
  id: null as number | null,
  jaar: todayYear,
  naam: "Zomerfeesten",
  start_datum: `${todayYear}-07-11`,
  eind_datum: `${todayYear}-07-17`,
  omzet_per_dag: 7500,
  percentage_melk: 65,
  percentage_vruchten: 35,
  aantal_machines: 3,
  kastruimte_bakken: 50,
  status: "concept" as "concept" | "actief" | "afgerond",
});

const legeNieuweSmaak = (): NieuweSmaak => ({
  recept_id: null,
  smaakcode: "",
  smaaknaam: "",
  soort: "melk",
  aantal_bakken: 0,
  kleur: "#93c5fd",
});

const formatEuro = (waarde: number) =>
  new Intl.NumberFormat("nl-NL", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(waarde || 0);

const datumVoorInput = (waarde?: string) => {
  if (!waarde) return "";
  return waarde.slice(0, 10);
};

const maakCode = (naam: string) =>
  naam
    .slice(0, 4)
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

const soortUitCategorie = (categorie?: string | null): "melk" | "vrucht" | "overig" => {
  const tekst = (categorie || "").toLowerCase();
  if (tekst.includes("vrucht") || tekst.includes("sorbet") || tekst.includes("fruit")) {
    return "vrucht";
  }
  if (tekst.includes("melk") || tekst.includes("room")) return "melk";
  return "melk";
};

export default function ZomerfeestenPage() {
  const { data: planningen } = useSWR<PlanningLijstItem[]>(
    "/api/admin/zomerfeesten/planningen",
    fetcher
  );
  const { data: recepten, error: receptenError } = useSWR<Recept[]>(
    "/api/admin/zomerfeesten/recepten",
    fetcher
  );

  const [planning, setPlanning] = useState(legePlanning());
  const [smaken, setSmaken] = useState<Smaak[]>([]);
  const [nieuweSmaak, setNieuweSmaak] = useState<NieuweSmaak>(legeNieuweSmaak());
  const [melding, setMelding] = useState<string | null>(null);
  const [opslaanBezig, setOpslaanBezig] = useState(false);

  const aantalDagen = useMemo(() => {
    const start = new Date(planning.start_datum);
    const eind = new Date(planning.eind_datum);
    if (Number.isNaN(start.getTime()) || Number.isNaN(eind.getTime())) return 0;
    return Math.max(0, Math.round((eind.getTime() - start.getTime()) / 86400000) + 1);
  }, [planning.start_datum, planning.eind_datum]);

  const totalen = useMemo(() => {
    const melk = smaken
      .filter((s) => s.soort === "melk")
      .reduce((sum, s) => sum + Number(s.aantal_bakken || 0), 0);
    const vrucht = smaken
      .filter((s) => s.soort === "vrucht")
      .reduce((sum, s) => sum + Number(s.aantal_bakken || 0), 0);
    const overig = smaken
      .filter((s) => s.soort === "overig")
      .reduce((sum, s) => sum + Number(s.aantal_bakken || 0), 0);
    return { melk, vrucht, overig, totaal: melk + vrucht + overig };
  }, [smaken]);

  const weekOmzet = Number(planning.omzet_per_dag || 0) * aantalDagen;
  const bakkenPerDag = aantalDagen > 0 ? totalen.totaal / aantalDagen : 0;

  const laadPlanning = async (id: number) => {
    setMelding(null);
    const detail: DetailResponse = await fetcher(
      `/api/admin/zomerfeesten/planningen?id=${id}`
    );

    setPlanning({
      id: detail.planning.id,
      jaar: Number(detail.planning.jaar),
      naam: detail.planning.naam || "Zomerfeesten",
      start_datum: datumVoorInput(detail.planning.start_datum),
      eind_datum: datumVoorInput(detail.planning.eind_datum),
      omzet_per_dag: Number(detail.planning.omzet_per_dag || 0),
      percentage_melk: Number(detail.planning.percentage_melk || 65),
      percentage_vruchten: Number(detail.planning.percentage_vruchten || 35),
      aantal_machines: Number(detail.planning.aantal_machines || 3),
      kastruimte_bakken: Number(detail.planning.kastruimte_bakken || 50),
      status: detail.planning.status || "concept",
    });

    setSmaken(
      detail.smaken.map((s) => ({
        ...s,
        recept_id: s.recept_id ? Number(s.recept_id) : null,
        aantal_bakken: Number(s.aantal_bakken || 0),
        kleur: s.kleur || "#93c5fd",
      }))
    );
  };

  const kiesNieuwRecept = (receptId: number | null) => {
    const recept = recepten?.find((r) => r.id === receptId);
    setNieuweSmaak((prev) => ({
      ...prev,
      recept_id: receptId,
      smaaknaam: recept?.naam || prev.smaaknaam,
      smaakcode: prev.smaakcode || maakCode(recept?.naam || ""),
      soort: soortUitCategorie(recept?.categorie),
    }));
  };

  const voegSmaakToe = () => {
    const smaaknaam = nieuweSmaak.smaaknaam.trim();
    const smaakcode = nieuweSmaak.smaakcode.trim().toUpperCase();

    if (!smaaknaam || !smaakcode) {
      setMelding("Kies een recept of vul minimaal een smaaknaam en code in.");
      return;
    }

    setSmaken((prev) => [
      ...prev,
      {
        recept_id: nieuweSmaak.recept_id,
        smaakcode,
        smaaknaam,
        soort: nieuweSmaak.soort,
        aantal_bakken: Number(nieuweSmaak.aantal_bakken || 0),
        kleur: nieuweSmaak.kleur || "#93c5fd",
        sortering: prev.length + 1,
      },
    ]);
    setNieuweSmaak(legeNieuweSmaak());
    setMelding(null);
  };

  const wijzigSmaak = (index: number, patch: Partial<Smaak>) => {
    setSmaken((prev) =>
      prev.map((s, i) => {
        if (i !== index) return s;
        return { ...s, ...patch };
      })
    );
  };

  const kiesBestaandRecept = (index: number, receptId: number | null) => {
    const recept = recepten?.find((r) => r.id === receptId);
    wijzigSmaak(index, {
      recept_id: receptId,
      smaaknaam: recept?.naam || smaken[index]?.smaaknaam || "",
      smaakcode: smaken[index]?.smaakcode || maakCode(recept?.naam || ""),
      soort: recept ? soortUitCategorie(recept.categorie) : smaken[index]?.soort || "melk",
    });
  };

  const opslaan = async () => {
    setOpslaanBezig(true);
    setMelding(null);

    try {
      const res = await fetch("/api/admin/zomerfeesten/planningen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...planning, smaken }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Opslaan mislukt");

      setPlanning((prev) => ({ ...prev, id: json.id }));
      setMelding("Zomerfeestenplanning opgeslagen.");
      mutate("/api/admin/zomerfeesten/planningen");
      await laadPlanning(json.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Opslaan mislukt";
      setMelding(message);
    } finally {
      setOpslaanBezig(false);
    }
  };

  const verwijderPlanning = async () => {
    if (!planning.id) return;
    if (!confirm(`Zomerfeestenplanning ${planning.jaar} verwijderen?`)) return;

    const res = await fetch(
      `/api/admin/zomerfeesten/planningen?id=${planning.id}`,
      { method: "DELETE" }
    );

    if (res.ok) {
      setPlanning(legePlanning());
      setSmaken([]);
      mutate("/api/admin/zomerfeesten/planningen");
      setMelding("Planning verwijderd.");
    }
  };

  return (
    <main className="min-h-screen w-full bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1180px] space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700">Zomerfeesten</p>
              <h1 className="text-2xl font-bold text-slate-900">
                Planning & smaakplanning
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Eerste bouwblok: jaargang aanmaken en aantal bakken per smaak vastleggen.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => {
                  setPlanning(legePlanning());
                  setSmaken([]);
                  setNieuweSmaak(legeNieuweSmaak());
                  setMelding(null);
                }}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <Plus className="h-4 w-4" /> Nieuwe planning
              </button>
              <button
                type="button"
                onClick={opslaan}
                disabled={opslaanBezig}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {opslaanBezig ? "Opslaan..." : "Opslaan"}
              </button>
            </div>
          </div>

          {melding && (
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              {melding}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                Bestaande planningen
              </h2>

              <div className="space-y-2">
                {(planningen ?? []).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => laadPlanning(p.id)}
                    className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                      planning.id === p.id
                        ? "border-blue-300 bg-blue-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-semibold text-slate-900">
                        {p.naam} {p.jaar}
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                        {p.status}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {Number(p.aantal_smaken || 0)} smaken · {Number(p.totaal_bakken || 0)} bakken
                    </div>
                  </button>
                ))}

                {planningen?.length === 0 && (
                  <p className="text-sm text-slate-500">Nog geen planningen.</p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                Samenvatting
              </h2>

              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Dagen</span>
                  <span className="font-semibold text-slate-900">{aantalDagen}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Weekomzet</span>
                  <span className="font-semibold text-slate-900">{formatEuro(weekOmzet)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Melk</span>
                  <span className="font-semibold text-slate-900">{totalen.melk}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Vrucht</span>
                  <span className="font-semibold text-slate-900">{totalen.vrucht}</span>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-slate-500">Totaal bakken</span>
                  <span className="font-bold text-slate-900">{totalen.totaal}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Bakken per dag</span>
                  <span className="font-semibold text-slate-900">{bakkenPerDag.toFixed(1)}</span>
                </div>
              </div>
            </section>
          </aside>

          <div className="min-w-0 space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <CalendarDays className="h-5 w-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-900">Planninggegevens</h2>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Jaar</span>
                  <input
                    type="number"
                    className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2"
                    value={planning.jaar}
                    onChange={(e) =>
                      setPlanning((p) => ({ ...p, jaar: Number(e.target.value) }))
                    }
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Naam</span>
                  <input
                    className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2"
                    value={planning.naam}
                    onChange={(e) =>
                      setPlanning((p) => ({ ...p, naam: e.target.value }))
                    }
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Startdatum</span>
                  <input
                    type="date"
                    className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2"
                    value={planning.start_datum}
                    onChange={(e) =>
                      setPlanning((p) => ({ ...p, start_datum: e.target.value }))
                    }
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Einddatum</span>
                  <input
                    type="date"
                    className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2"
                    value={planning.eind_datum}
                    onChange={(e) =>
                      setPlanning((p) => ({ ...p, eind_datum: e.target.value }))
                    }
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Omzet per dag</span>
                  <div className="relative">
                    <Euro className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                      type="number"
                      className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3"
                      value={planning.omzet_per_dag}
                      onChange={(e) =>
                        setPlanning((p) => ({
                          ...p,
                          omzet_per_dag: Number(e.target.value),
                        }))
                      }
                    />
                  </div>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">% melk</span>
                  <input
                    type="number"
                    className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2"
                    value={planning.percentage_melk}
                    onChange={(e) =>
                      setPlanning((p) => ({
                        ...p,
                        percentage_melk: Number(e.target.value),
                      }))
                    }
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">% vruchten</span>
                  <input
                    type="number"
                    className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2"
                    value={planning.percentage_vruchten}
                    onChange={(e) =>
                      setPlanning((p) => ({
                        ...p,
                        percentage_vruchten: Number(e.target.value),
                      }))
                    }
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Status</span>
                  <select
                    className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2"
                    value={planning.status}
                    onChange={(e) =>
                      setPlanning((p) => ({
                        ...p,
                        status: e.target.value as "concept" | "actief" | "afgerond",
                      }))
                    }
                  >
                    <option value="concept">Concept</option>
                    <option value="actief">Actief</option>
                    <option value="afgerond">Afgerond</option>
                  </select>
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Machines</span>
                  <input
                    type="number"
                    className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2"
                    value={planning.aantal_machines}
                    onChange={(e) =>
                      setPlanning((p) => ({
                        ...p,
                        aantal_machines: Number(e.target.value),
                      }))
                    }
                  />
                </label>

                <label className="space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Kastruimte bakken</span>
                  <input
                    type="number"
                    className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2"
                    value={planning.kastruimte_bakken}
                    onChange={(e) =>
                      setPlanning((p) => ({
                        ...p,
                        kastruimte_bakken: Number(e.target.value),
                      }))
                    }
                  />
                </label>
              </div>
            </section>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="mb-4 flex items-center gap-2">
              <IceCream className="h-5 w-5 text-blue-600" />
              <h2 className="text-lg font-bold text-slate-900">Smaakplanning</h2>
            </div>

              {receptenError && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  Keukenrecepten konden niet worden opgehaald. Controleer de API-route of tabelnaam.
                </div>
              )}

              {!receptenError && recepten && recepten.length === 0 && (
                <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                  Er zijn nog geen actieve keukenrecepten gevonden om te koppelen.
                </div>
              )}

              <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                  Smaak toevoegen
                </h3>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,2fr)_120px_minmax(190px,1.5fr)_120px_110px]">
                  <label className="min-w-0 space-y-1 text-sm md:col-span-2 xl:col-span-1">
                    <span className="font-medium text-slate-700">Keukenrecept</span>
                    <select
                      className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2"
                      value={nieuweSmaak.recept_id ?? ""}
                      onChange={(e) =>
                        kiesNieuwRecept(e.target.value ? Number(e.target.value) : null)
                      }
                    >
                      <option value="">-- kies keukenrecept --</option>
                      {(recepten ?? []).map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.categorie ? `${r.categorie} · ` : ""}
                          {r.naam}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-slate-700">Code</span>
                    <input
                      className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 uppercase"
                      value={nieuweSmaak.smaakcode}
                      onChange={(e) =>
                        setNieuweSmaak((s) => ({
                          ...s,
                          smaakcode: e.target.value.toUpperCase(),
                        }))
                      }
                    />
                  </label>

                  <label className="min-w-0 space-y-1 text-sm md:col-span-2 xl:col-span-1">
                    <span className="font-medium text-slate-700">Smaaknaam</span>
                    <input
                      className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2"
                      value={nieuweSmaak.smaaknaam}
                      onChange={(e) =>
                        setNieuweSmaak((s) => ({ ...s, smaaknaam: e.target.value }))
                      }
                    />
                  </label>

                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-slate-700">Soort</span>
                    <select
                      className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2"
                      value={nieuweSmaak.soort}
                      onChange={(e) =>
                        setNieuweSmaak((s) => ({
                          ...s,
                          soort: e.target.value as "melk" | "vrucht" | "overig",
                        }))
                      }
                    >
                      <option value="melk">Melk</option>
                      <option value="vrucht">Vrucht</option>
                      <option value="overig">Overig</option>
                    </select>
                  </label>

                  <label className="space-y-1 text-sm">
                    <span className="font-medium text-slate-700">Bakken</span>
                    <input
                      type="number"
                      step="0.1"
                      className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2 text-right"
                      value={nieuweSmaak.aantal_bakken}
                      onChange={(e) =>
                        setNieuweSmaak((s) => ({
                          ...s,
                          aantal_bakken: Number(e.target.value),
                        }))
                      }
                    />
                  </label>

                  <div className="flex min-w-0 flex-wrap items-end gap-3 md:col-span-2 xl:col-span-5">
                    <label className="space-y-1 text-sm">
                      <span className="font-medium text-slate-700">Kleur</span>
                      <input
                        type="color"
                        className="h-10 w-14 rounded border border-slate-200 bg-white p-1"
                        value={nieuweSmaak.kleur || "#93c5fd"}
                        onChange={(e) =>
                          setNieuweSmaak((s) => ({ ...s, kleur: e.target.value }))
                        }
                      />
                    </label>

                    <button
                      type="button"
                      onClick={voegSmaakToe}
                      className="mb-0 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white hover:bg-slate-800"
                    >
                      <Plus className="h-4 w-4" /> Toevoegen
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {smaken.map((smaak, index) => (
                  <div
                    key={index}
                    className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                  >
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(170px,1.2fr)_78px_minmax(135px,1fr)_96px_78px_74px_86px] xl:items-end">
                      <label className="space-y-1 text-sm">
                        <span className="font-medium text-slate-700">Keukenrecept</span>
                        <select
                          className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2"
                          value={smaak.recept_id ?? ""}
                          onChange={(e) =>
                            kiesBestaandRecept(
                              index,
                              e.target.value ? Number(e.target.value) : null
                            )
                          }
                        >
                          <option value="">-- kies keukenrecept --</option>
                          {(recepten ?? []).map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.categorie ? `${r.categorie} · ` : ""}
                              {r.naam}
                            </option>
                          ))}
                        </select>
                      </label>

                      <label className="space-y-1 text-sm">
                        <span className="font-medium text-slate-700">Code</span>
                        <input
                          className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2 uppercase"
                          value={smaak.smaakcode}
                          onChange={(e) =>
                            wijzigSmaak(index, {
                              smaakcode: e.target.value.toUpperCase(),
                            })
                          }
                        />
                      </label>

                      <label className="space-y-1 text-sm">
                        <span className="font-medium text-slate-700">Smaaknaam</span>
                        <input
                          className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2"
                          value={smaak.smaaknaam}
                          onChange={(e) =>
                            wijzigSmaak(index, { smaaknaam: e.target.value })
                          }
                        />
                      </label>

                      <label className="space-y-1 text-sm">
                        <span className="font-medium text-slate-700">Soort</span>
                        <select
                          className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2"
                          value={smaak.soort}
                          onChange={(e) =>
                            wijzigSmaak(index, {
                              soort: e.target.value as "melk" | "vrucht" | "overig",
                            })
                          }
                        >
                          <option value="melk">Melk</option>
                          <option value="vrucht">Vrucht</option>
                          <option value="overig">Overig</option>
                        </select>
                      </label>

                      <label className="space-y-1 text-sm">
                        <span className="font-medium text-slate-700">Bakken</span>
                        <input
                          type="number"
                          step="0.1"
                          className="w-full min-w-0 rounded-xl border border-slate-200 px-3 py-2 text-right"
                          value={smaak.aantal_bakken}
                          onChange={(e) =>
                            wijzigSmaak(index, {
                              aantal_bakken: Number(e.target.value),
                            })
                          }
                        />
                      </label>

                      <div className="space-y-1 text-sm">
                        <span className="font-medium text-slate-700">Per dag</span>
                        <div className="rounded-xl bg-slate-50 px-2 py-2 text-right font-semibold text-slate-700">
                          {aantalDagen > 0
                            ? (Number(smaak.aantal_bakken || 0) / aantalDagen).toFixed(1)
                            : "-"}
                        </div>
                      </div>

                      <div className="flex min-w-0 items-end gap-2">
                        <label className="space-y-1 text-sm">
                          <span className="font-medium text-slate-700">Kleur</span>
                          <input
                            type="color"
                            className="h-10 w-14 rounded border border-slate-200 bg-white p-1"
                            value={smaak.kleur || "#93c5fd"}
                            onChange={(e) =>
                              wijzigSmaak(index, { kleur: e.target.value })
                            }
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            setSmaken((prev) => prev.filter((_, i) => i !== index))
                          }
                          className="mb-0 shrink-0 rounded-xl p-3 text-red-600 hover:bg-red-50"
                          title="Verwijderen"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {smaken.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    Nog geen smaken toegevoegd.
                  </div>
                )}
              </div>

              <div className="mt-4 flex flex-col gap-2 rounded-xl bg-slate-50 p-4 text-sm text-slate-700 md:flex-row md:items-center md:justify-between">
                <div className="flex items-center gap-2 font-medium text-slate-900">
                  <Check className="h-4 w-4 text-emerald-600" />
                  Totaal: {totalen.totaal} bakken
                </div>
                <div className="text-slate-600">
                  Melk {totalen.melk} · Vrucht {totalen.vrucht} · Overig {totalen.overig}
                </div>
              </div>
          </section>

          {planning.id && (
            <div className="flex justify-end lg:col-span-2">
              <button
                type="button"
                onClick={verwijderPlanning}
                className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" /> Planning verwijderen
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
