"use client";

import useSWR from "swr";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  RefreshCw,
  Search,
  UserCheck,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type Instructie = {
  id: string;
  titel: string;
  slug: string;
  nummer: string | null;
  onboarding_fase: string;
  onboarding_fase_label: string;
  gelezen: boolean;
};

type OnboardingItem = {
  medewerker: {
    id: number;
    naam: string;
    email: string;
    functie: string | null;
    functies: string[];
    eerste_werkdag: string | null;
  };
  samenvatting: {
    totaal: number;
    gelezen: number;
    open: number;
    afgerond: boolean;
  };
  perFase: {
    fase: string;
    label: string;
    totaal: number;
    gelezen: number;
    open: number;
    instructies: Instructie[];
  }[];
  openInstructies: Instructie[];
};

type OnboardingResponse = {
  success: boolean;
  data: {
    medewerkers: OnboardingItem[];
    samenvatting: {
      medewerkers: number;
      afgerond: number;
      metOpenTaken: number;
      openInstructies: number;
    };
  };
  error?: string;
};

function formatDate(value: string | null) {
  if (!value) return "-";

  return new Date(value).toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function OnboardingPage() {
  const { data, error, isLoading, mutate } = useSWR<OnboardingResponse>(
    "/api/admin/onboarding",
    fetcher
  );

  const [zoekterm, setZoekterm] = useState("");
  const [alleenOpen, setAlleenOpen] = useState(true);
  const [bezig, setBezig] = useState<string | null>(null);
  const [melding, setMelding] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  const medewerkers = data?.data?.medewerkers || [];
  const samenvatting = data?.data?.samenvatting;

  const gefilterd = useMemo(() => {
    const zoek = zoekterm.trim().toLowerCase();

    return medewerkers.filter((item) => {
      if (alleenOpen && item.samenvatting.open === 0) return false;

      if (!zoek) return true;

      return (
        item.medewerker.naam?.toLowerCase().includes(zoek) ||
        item.medewerker.email?.toLowerCase().includes(zoek) ||
        item.medewerker.functie?.toLowerCase().includes(zoek) ||
        item.medewerker.functies.some((functie) =>
          functie.toLowerCase().includes(zoek)
        )
      );
    });
  }, [medewerkers, zoekterm, alleenOpen]);

  async function vinkAf(email: string, instructieIds: string[], naam: string) {
    if (instructieIds.length === 0) return;

    const akkoord = window.confirm(
      `Markeer ${instructieIds.length} instructie(s) als gelezen voor ${naam}?`
    );

    if (!akkoord) return;

    setBezig(email);
    setMelding(null);
    setFout(null);

    try {
      const res = await fetch("/api/admin/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          instructieIds,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setFout(json.error || "Afvinken mislukt.");
        return;
      }

      setMelding(`${json.aantal} instructie(s) afgevinkt voor ${naam}.`);
      mutate();
    } catch (error) {
      setFout(`Afvinken mislukt: ${String(error)}`);
    } finally {
      setBezig(null);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4">
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
            >
              <ArrowLeft className="h-4 w-4" />
              Terug naar admin
            </Link>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                <ClipboardCheck className="h-4 w-4" />
                Onboarding
              </div>

              <h1 className="text-2xl font-bold text-slate-900">
                Onboarding controle
              </h1>

              <p className="mt-1 text-sm text-slate-600">
                Controleer per medewerker welke verplichte instructies nog
                openstaan. Bestaande medewerkers kun je hier handmatig als
                gelezen afvinken.
              </p>
            </div>

            <button
              type="button"
              onClick={() => mutate()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Vernieuwen
            </button>
          </div>
        </section>

        {samenvatting && (
          <section className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-500">Medewerkers</div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                {samenvatting.medewerkers}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-500">Afgerond</div>
              <div className="mt-1 text-2xl font-bold text-emerald-700">
                {samenvatting.afgerond}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-500">
                Met open instructies
              </div>
              <div className="mt-1 text-2xl font-bold text-orange-700">
                {samenvatting.metOpenTaken}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="text-sm text-slate-500">Open instructies</div>
              <div className="mt-1 text-2xl font-bold text-red-700">
                {samenvatting.openInstructies}
              </div>
            </div>
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <label className="relative block md:w-96">
              <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                value={zoekterm}
                onChange={(e) => setZoekterm(e.target.value)}
                placeholder="Zoek medewerker, functie of e-mail..."
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </label>

            <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={alleenOpen}
                onChange={(e) => setAlleenOpen(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Alleen medewerkers met open instructies
            </label>
          </div>
        </section>

        {melding && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 shadow-sm">
            {melding}
          </div>
        )}

        {fout && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800 shadow-sm">
            {fout}
          </div>
        )}

        {isLoading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
            Onboarding laden...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800 shadow-sm">
            Onboarding kon niet worden geladen.
          </div>
        )}

        {data && !data.success && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800 shadow-sm">
            {data.error || "Onboarding kon niet worden opgehaald."}
          </div>
        )}

        <section className="space-y-4">
          {gefilterd.map((item) => {
            const openIds = item.openInstructies.map((i) => String(i.id));

            const alleIds = item.perFase
              .flatMap((fase) => fase.instructies)
              .map((i) => String(i.id));

            return (
              <div
                key={item.medewerker.email}
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-bold text-slate-900">
                        {item.medewerker.naam}
                      </h2>

                      {item.samenvatting.afgerond ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Afgerond
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-700">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          {item.samenvatting.open} open
                        </span>
                      )}
                    </div>

                    <div className="mt-1 text-sm text-slate-600">
                      {item.medewerker.functie || "-"} · eerste werkdag:{" "}
                      {formatDate(item.medewerker.eerste_werkdag)}
                    </div>

                    <div className="mt-2 flex flex-wrap gap-1">
                      {item.medewerker.functies.length > 0 ? (
                        item.medewerker.functies.map((functie) => (
                          <span
                            key={functie}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600"
                          >
                            {functie}
                          </span>
                        ))
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                          Geen functie gekoppeld
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {openIds.length > 0 && (
                      <button
                        type="button"
                        disabled={bezig === item.medewerker.email}
                        onClick={() =>
                          vinkAf(
                            item.medewerker.email,
                            openIds,
                            item.medewerker.naam
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <UserCheck className="h-4 w-4" />
                        Open afvinken
                      </button>
                    )}

                    {alleIds.length > 0 && (
                      <button
                        type="button"
                        disabled={bezig === item.medewerker.email}
                        onClick={() =>
                          vinkAf(
                            item.medewerker.email,
                            alleIds,
                            item.medewerker.naam
                          )
                        }
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Alles als gelezen
                      </button>
                    )}
                  </div>
                </div>

                <div className="mb-4 grid gap-3 md:grid-cols-3">
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Totaal
                    </div>
                    <div className="mt-1 text-xl font-bold text-slate-900">
                      {item.samenvatting.totaal}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Gelezen
                    </div>
                    <div className="mt-1 text-xl font-bold text-emerald-700">
                      {item.samenvatting.gelezen}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
                      Open
                    </div>
                    <div className="mt-1 text-xl font-bold text-orange-700">
                      {item.samenvatting.open}
                    </div>
                  </div>
                </div>

                {item.samenvatting.totaal === 0 ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    Voor deze medewerker zijn geen verplichte
                    onboarding-instructies gekoppeld.
                  </div>
                ) : (
                  <div className="grid gap-3 md:grid-cols-3">
                    {item.perFase
                      .filter((fase) => fase.totaal > 0)
                      .map((fase) => (
                        <div
                          key={fase.fase}
                          className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                        >
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <div className="font-semibold text-slate-900">
                              {fase.label}
                            </div>

                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                                fase.open === 0
                                  ? "bg-emerald-100 text-emerald-700"
                                  : "bg-orange-100 text-orange-700"
                              }`}
                            >
                              {fase.gelezen}/{fase.totaal}
                            </span>
                          </div>

                          <div className="space-y-2">
                            {fase.instructies.map((instructie) => (
                              <div
                                key={instructie.id}
                                className="flex items-start gap-2 text-sm"
                              >
                                {instructie.gelezen ? (
                                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-600" />
                                ) : (
                                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-none text-orange-500" />
                                )}

                                <div className="flex-1">
                                  <div
                                    className={
                                      instructie.gelezen
                                        ? "text-slate-500"
                                        : "font-medium text-slate-900"
                                    }
                                  >
                                    {instructie.nummer
                                      ? `${instructie.nummer}. `
                                      : ""}
                                    {instructie.titel}
                                  </div>

                                  {!instructie.gelezen && (
                                    <button
                                      type="button"
                                      disabled={bezig === item.medewerker.email}
                                      onClick={() =>
                                        vinkAf(
                                          item.medewerker.email,
                                          [String(instructie.id)],
                                          item.medewerker.naam
                                        )
                                      }
                                      className="mt-1 text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      Markeer als gelezen
                                    </button>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            );
          })}
        </section>

        {!isLoading && gefilterd.length === 0 && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center text-emerald-800 shadow-sm">
            Geen medewerkers met open onboarding-instructies gevonden.
          </div>
        )}
      </div>
    </main>
  );
}