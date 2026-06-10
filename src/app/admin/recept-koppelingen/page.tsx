"use client";

import useSWR from "swr";
import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  RefreshCw,
  Save,
  Search,
  Trash2,
} from "lucide-react";

type Status =
  | "naam_match"
  | "handmatig"
  | "gekoppeld"
  | "ontbreekt_kostprijs"
  | "controle_nodig";

type KostprijsRecept = {
  id: number;
  naam: string;
  categorie?: string | null;
};

type KoppelingRij = {
  id: number | null;
  keuken_recept_id: number;
  keuken_naam: string;
  keuken_categorie?: string | null;
  kostprijs_recept_id: number | null;
  kostprijs_naam?: string | null;
  kostprijs_categorie?: string | null;
  status: Status;
  opmerking?: string | null;
  automatische_match_id: number | null;
  automatische_match_naam?: string | null;
  berekenbaar: boolean;
};

type ApiResponse = {
  rijen: KoppelingRij[];
  kostprijsRecepten: KostprijsRecept[];
  samenvatting: {
    totaal: number;
    gekoppeld: number;
    automatische_match: number;
    ontbreekt: number;
    controle_nodig: number;
  };
};

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Fout bij ophalen");
  return json;
};

const statusLabel: Record<Status, string> = {
  naam_match: "Automatische match",
  handmatig: "Handmatig gekoppeld",
  gekoppeld: "Gekoppeld",
  ontbreekt_kostprijs: "Mist kostprijsrecept",
  controle_nodig: "Controle nodig",
};

const statusClass: Record<Status, string> = {
  naam_match: "bg-blue-50 text-blue-700 border-blue-200",
  handmatig: "bg-emerald-50 text-emerald-700 border-emerald-200",
  gekoppeld: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ontbreekt_kostprijs: "bg-amber-50 text-amber-800 border-amber-200",
  controle_nodig: "bg-rose-50 text-rose-700 border-rose-200",
};

const normaliseer = (waarde: string) => waarde.trim().toLowerCase();

export default function ReceptKoppelingenPage() {
  const { data, error, isLoading, mutate } = useSWR<ApiResponse>(
    "/api/admin/recept-koppelingen",
    fetcher
  );

  const [zoekterm, setZoekterm] = useState("");
  const [filter, setFilter] = useState<"alles" | "open" | Status>("open");
  const [melding, setMelding] = useState<string | null>(null);
  const [bezigId, setBezigId] = useState<number | null>(null);

  const rijen = data?.rijen ?? [];
  const kostprijsRecepten = data?.kostprijsRecepten ?? [];

  const gefilterdeRijen = useMemo(() => {
    const q = normaliseer(zoekterm);
    return rijen.filter((rij) => {
      const matchZoekterm =
        !q ||
        normaliseer(rij.keuken_naam).includes(q) ||
        normaliseer(rij.kostprijs_naam || "").includes(q) ||
        normaliseer(rij.keuken_categorie || "").includes(q);

      const matchFilter =
        filter === "alles" ||
        (filter === "open" &&
          (!rij.kostprijs_recept_id || rij.status === "naam_match" || rij.status === "controle_nodig")) ||
        rij.status === filter;

      return matchZoekterm && matchFilter;
    });
  }, [filter, rijen, zoekterm]);

  const slaKoppelingOp = async (
    rij: KoppelingRij,
    kostprijsReceptId: number | null,
    status: Status,
    opmerking = rij.opmerking || ""
  ) => {
    setBezigId(rij.keuken_recept_id);
    setMelding(null);

    try {
      const res = await fetch("/api/admin/recept-koppelingen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          keuken_recept_id: rij.keuken_recept_id,
          kostprijs_recept_id: kostprijsReceptId,
          status,
          opmerking,
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Opslaan mislukt");

      setMelding(`Koppeling opgeslagen voor ${rij.keuken_naam}.`);
      await mutate();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Opslaan mislukt";
      setMelding(message);
    } finally {
      setBezigId(null);
    }
  };

  const verwijderKoppeling = async (rij: KoppelingRij) => {
    if (!rij.id) return;
    if (!confirm(`Koppeling voor ${rij.keuken_naam} verwijderen?`)) return;

    setBezigId(rij.keuken_recept_id);
    setMelding(null);

    try {
      const res = await fetch(
        `/api/admin/recept-koppelingen?keuken_recept_id=${rij.keuken_recept_id}`,
        { method: "DELETE" }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Verwijderen mislukt");
      setMelding(`Koppeling verwijderd voor ${rij.keuken_naam}.`);
      await mutate();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Verwijderen mislukt";
      setMelding(message);
    } finally {
      setBezigId(null);
    }
  };

  const bevestigAutomatischeMatch = (rij: KoppelingRij) => {
    if (!rij.automatische_match_id) return;
    slaKoppelingOp(rij, rij.automatische_match_id, "gekoppeld", "Automatisch gematcht op gelijke naam.");
  };

  if (isLoading) {
    return <main className="p-6 text-slate-600">Receptkoppelingen laden...</main>;
  }

  if (error) {
    return (
      <main className="p-6 text-rose-700">
        Fout bij laden receptkoppelingen: {error.message}
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-sm font-medium text-blue-700">Recepturen</p>
              <h1 className="text-2xl font-bold text-slate-900">Receptkoppelingen</h1>
              <p className="mt-1 max-w-3xl text-sm text-slate-600">
                Koppel keukenrecepten aan kostprijsrecepten. De keukenrecepten blijven leidend voor planning en keukenweergave; de kostprijsrecepten zijn leidend voor ingrediënten, leveranciers, bestellijst en kosten.
              </p>
            </div>

            <button
              type="button"
              onClick={() => mutate()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" /> Vernieuwen
            </button>
          </div>

          {melding && (
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
              {melding}
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Totaal</p>
            <p className="mt-2 text-2xl font-bold text-slate-900">{data?.samenvatting.totaal ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Gekoppeld</p>
            <p className="mt-2 text-2xl font-bold text-emerald-700">{data?.samenvatting.gekoppeld ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Automatische match</p>
            <p className="mt-2 text-2xl font-bold text-blue-700">{data?.samenvatting.automatische_match ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Mist kostprijs</p>
            <p className="mt-2 text-2xl font-bold text-amber-700">{data?.samenvatting.ontbreekt ?? 0}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">Controle nodig</p>
            <p className="mt-2 text-2xl font-bold text-rose-700">{data?.samenvatting.controle_nodig ?? 0}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_240px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={zoekterm}
                onChange={(e) => setZoekterm(e.target.value)}
                placeholder="Zoek op keukenrecept, kostprijsrecept of categorie..."
                className="w-full rounded-xl border border-slate-200 py-2 pl-10 pr-3 text-sm"
              />
            </label>

            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="open">Open / te controleren</option>
              <option value="alles">Alles</option>
              <option value="naam_match">Automatische match</option>
              <option value="handmatig">Handmatig gekoppeld</option>
              <option value="gekoppeld">Gekoppeld</option>
              <option value="ontbreekt_kostprijs">Mist kostprijsrecept</option>
              <option value="controle_nodig">Controle nodig</option>
            </select>
          </div>
        </section>

        <section className="space-y-3">
          {gefilterdeRijen.map((rij) => {
            const gekozenKostprijsId = rij.kostprijs_recept_id ?? rij.automatische_match_id ?? "";
            const isBezig = bezigId === rij.keuken_recept_id;

            return (
              <article
                key={rij.keuken_recept_id}
                className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(220px,1fr)_minmax(260px,1.25fr)_170px] xl:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-lg font-bold text-slate-900">{rij.keuken_naam}</h2>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                        Keuken
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-500">{rij.keuken_categorie || "Geen categorie"}</p>
                    {rij.automatische_match_id && !rij.id && (
                      <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
                        <Link2 className="h-4 w-4" /> Match gevonden: {rij.automatische_match_naam}
                      </div>
                    )}
                    {!rij.automatische_match_id && !rij.kostprijs_recept_id && (
                      <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                        <AlertTriangle className="h-4 w-4" /> Geen kostprijsrecept met gelijke naam gevonden
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 space-y-2">
                    <label className="block space-y-1 text-sm">
                      <span className="font-medium text-slate-700">Kostprijsrecept</span>
                      <select
                        value={gekozenKostprijsId}
                        onChange={(e) => {
                          const value = e.target.value ? Number(e.target.value) : null;
                          slaKoppelingOp(rij, value, value ? "handmatig" : "ontbreekt_kostprijs");
                        }}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      >
                        <option value="">Geen kostprijsrecept</option>
                        {kostprijsRecepten.map((recept) => (
                          <option key={recept.id} value={recept.id}>
                            {recept.categorie ? `${recept.categorie} · ` : ""}{recept.naam}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full border px-2 py-1 text-xs font-semibold ${statusClass[rij.status]}`}>
                        {statusLabel[rij.status]}
                      </span>
                      {rij.berekenbaar && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Doorrekenbaar
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 sm:flex-row xl:flex-col">
                    {rij.automatische_match_id && !rij.id && (
                      <button
                        type="button"
                        disabled={isBezig}
                        onClick={() => bevestigAutomatischeMatch(rij)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
                      >
                        <CheckCircle2 className="h-4 w-4" /> Bevestig
                      </button>
                    )}
                    {rij.kostprijs_recept_id && (
                      <button
                        type="button"
                        disabled={isBezig}
                        onClick={() => slaKoppelingOp(rij, rij.kostprijs_recept_id, "gekoppeld", rij.opmerking || "")}
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-60"
                      >
                        <Save className="h-4 w-4" /> Goedkeuren
                      </button>
                    )}
                    {!rij.kostprijs_recept_id && !rij.automatische_match_id && (
                      <button
                        type="button"
                        disabled={isBezig}
                        onClick={() => slaKoppelingOp(rij, null, "ontbreekt_kostprijs", "Geen kostprijsrecept beschikbaar.")}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800 hover:bg-amber-100 disabled:opacity-60"
                      >
                        Markeer ontbreekt
                      </button>
                    )}
                    {rij.id && (
                      <button
                        type="button"
                        disabled={isBezig}
                        onClick={() => verwijderKoppeling(rij)}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                      >
                        <Trash2 className="h-4 w-4" /> Reset
                      </button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}

          {gefilterdeRijen.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
              Geen recepten gevonden binnen deze filter.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
