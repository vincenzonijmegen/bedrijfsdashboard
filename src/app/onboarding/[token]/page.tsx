"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Loader2,
} from "lucide-react";
import { useParams } from "next/navigation";

const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  const json = await res.json();

  if (!res.ok) {
    throw new Error(json?.error || "Laden mislukt");
  }

  return json;
};

type Optie = {
  id: string;
  tekst: string;
  sortering: number;
};

type Vraag = {
  id: string;
  vraag: string;
  uitleg: string | null;
  type: "multiple_choice" | "bevestiging";
  verplicht: boolean;
  sortering: number;
  opties: Optie[];
};

type Opdracht = {
  id: string;
  medewerker_email: string;
  medewerker_naam: string;
  instructie_id: string;
  status: string;
  titel: string;
  nummer: string | null;
  inhoud: string;
  afgerond_op: string | null;
};

type TokenResponse = {
  success: boolean;
  opdracht: Opdracht;
  vragen: Vraag[];
  heeftVragen: boolean;
  error?: string;
};

function schoneInstructieHtml(html: string) {
  return String(html || "")
    .replace(/\[end\]/gi, "")
    .replace(/<p>\s*<\/p>/gi, "")
    .trim();
}

export default function OnboardingTokenPage() {
  const params = useParams();
  const token = String(params?.token || "");

  const { data, error, isLoading, mutate } = useSWR<TokenResponse>(
    token ? `/api/onboarding/token/${token}` : null,
    fetcher
  );

  const [antwoorden, setAntwoorden] = useState<Record<string, string>>({});
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [fouteVragen, setFouteVragen] = useState<string[]>([]);

  const opdracht = data?.opdracht || null;
  const vragen = data?.vragen || [];
  const heeftVragen = Boolean(data?.heeftVragen && vragen.length > 0);

  const isAfgerond =
    opdracht?.status === "afgerond" || Boolean(opdracht?.afgerond_op);

  const titel = opdracht
    ? opdracht.nummer
      ? `${opdracht.nummer}. ${opdracht.titel}`
      : opdracht.titel
    : "Onboarding";

  const alleVerplichteVragenBeantwoord = vragen
    .filter((vraag) => vraag.verplicht)
    .every((vraag) => Boolean(antwoorden[vraag.id]));

  function kiesAntwoord(vraagId: string, optieId: string) {
    setAntwoorden((huidig) => ({
      ...huidig,
      [vraagId]: optieId,
    }));

    setFout(null);
    setFouteVragen([]);
  }

  async function bevestigZonderVragen() {
    setBezig(true);
    setMelding(null);
    setFout(null);

    try {
      const res = await fetch(`/api/onboarding/token/${token}`, {
        method: "POST",
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setFout(json.error || "Bevestigen is niet gelukt.");
        return;
      }

      setMelding("Dank je wel. De instructie is opgeslagen als gelezen.");
      await mutate();
    } catch (error) {
      setFout(`Bevestigen is niet gelukt: ${String(error)}`);
    } finally {
      setBezig(false);
    }
  }

  async function verstuurAntwoorden() {
    if (!alleVerplichteVragenBeantwoord) {
      setFout("Beantwoord eerst alle verplichte vragen.");
      return;
    }

    setBezig(true);
    setMelding(null);
    setFout(null);
    setFouteVragen([]);

    try {
      const payload = {
        antwoorden: Object.entries(antwoorden).map(([vraagId, optieId]) => ({
          vraagId,
          optieId,
        })),
      };

      const res = await fetch(`/api/onboarding/token/${token}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setFout(json.error || "De vragen konden niet worden opgeslagen.");
        return;
      }

      if (json.geslaagd) {
        setMelding(
          "Goed gedaan. Je hebt de vragen juist beantwoord en de instructie is afgerond."
        );
        await mutate();
      } else {
        setFouteVragen(json.fouten || []);
        setFout(
          `Je had ${json.aantalCorrect} van de ${json.aantalVragen} vragen goed. Verbeter de foute antwoorden en probeer opnieuw.`
        );
      }
    } catch (error) {
      setFout(`De vragen konden niet worden opgeslagen: ${String(error)}`);
    } finally {
      setBezig(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-2 inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
            IJssalon Vincenzo onboarding
          </div>

          <h1 className="text-2xl font-bold text-slate-900">{titel}</h1>

          {opdracht?.medewerker_naam && (
            <p className="mt-1 text-sm text-slate-600">
              Voor: {opdracht.medewerker_naam}
            </p>
          )}
        </section>

        {isLoading && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Instructie laden...
            </div>
          </section>
        )}

        {error && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm">
            Deze onboardinglink kon niet worden geladen: {String(error)}
          </section>
        )}

        {data && !data.success && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm">
            {data.error || "Deze onboardinglink is niet geldig."}
          </section>
        )}

        {opdracht && (
          <>
            {isAfgerond && (
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800 shadow-sm">
                <div className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none" />
                  <div>
                    <div className="font-bold">Deze instructie is afgerond.</div>
                    <div className="mt-1 text-sm">
                      Je hoeft niets meer te doen. Je kunt de instructie hieronder
                      nog wel nalezen.
                    </div>
                  </div>
                </div>
              </section>
            )}

            {melding && (
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800 shadow-sm">
                {melding}
              </section>
            )}

            {fout && (
              <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm">
                {fout}
              </section>
            )}

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div
                className="prose max-w-none prose-slate"
                dangerouslySetInnerHTML={{
                  __html: schoneInstructieHtml(opdracht.inhoud || ""),
                }}
              />
            </section>

            {!isAfgerond && !heeftVragen && (
              <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-bold text-slate-900">
                      Bevestig dat je deze instructie hebt gelezen
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      Klik op de knop als je de instructie hebt gelezen en
                      begrepen.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={bevestigZonderVragen}
                    disabled={bezig}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {bezig ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Ik heb dit gelezen en begrepen
                  </button>
                </div>
              </section>
            )}

            {!isAfgerond && heeftVragen && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-start gap-3">
                  <div className="rounded-xl bg-blue-50 p-2 text-blue-700">
                    <ClipboardList className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      Controlevragen
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      Beantwoord de vragen hieronder. Als alles goed is, wordt
                      deze instructie automatisch afgerond.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  {vragen.map((vraag, index) => {
                    const gekozenOptieId = antwoorden[vraag.id];
                    const foutVraag = fouteVragen.includes(vraag.id);

                    return (
                      <div
                        key={vraag.id}
                        className={`rounded-2xl border p-4 ${
                          foutVraag
                            ? "border-red-200 bg-red-50"
                            : "border-slate-200 bg-slate-50"
                        }`}
                      >
                        <div className="mb-3">
                          <div className="text-sm font-semibold text-slate-500">
                            Vraag {index + 1}
                          </div>
                          <div className="mt-1 font-bold text-slate-900">
                            {vraag.vraag}
                          </div>
                        </div>

                        <div className="space-y-2">
                          {vraag.opties.map((optie) => (
                            <label
                              key={optie.id}
                              className={`flex cursor-pointer gap-3 rounded-xl border bg-white p-3 text-sm transition ${
                                gekozenOptieId === optie.id
                                  ? "border-blue-400 ring-2 ring-blue-100"
                                  : "border-slate-200 hover:bg-slate-50"
                              }`}
                            >
                              <input
                                type="radio"
                                name={vraag.id}
                                checked={gekozenOptieId === optie.id}
                                onChange={() =>
                                  kiesAntwoord(vraag.id, optie.id)
                                }
                                className="mt-0.5 h-4 w-4"
                              />
                              <span className="text-slate-800">
                                {optie.tekst}
                              </span>
                            </label>
                          ))}
                        </div>

                        {foutVraag && (
                          <div className="mt-3 flex gap-2 text-sm font-medium text-red-700">
                            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                            Dit antwoord was niet juist.
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-blue-200 bg-blue-50 p-4 md:flex-row md:items-center md:justify-between">
                  <div className="text-sm text-slate-700">
                    {alleVerplichteVragenBeantwoord
                      ? "Alle vragen zijn beantwoord."
                      : "Beantwoord eerst alle vragen."}
                  </div>

                  <button
                    type="button"
                    onClick={verstuurAntwoorden}
                    disabled={bezig || !alleVerplichteVragenBeantwoord}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {bezig ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    Antwoorden versturen
                  </button>
                </div>
              </section>
            )}

            <section className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800 shadow-sm">
              <div className="flex gap-2">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                Heb je vragen over deze instructie? Bespreek dit dan met je
                leidinggevende voordat je aan het werk gaat.
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}