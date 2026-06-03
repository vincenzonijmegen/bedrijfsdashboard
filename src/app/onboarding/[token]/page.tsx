"use client";

import { useState } from "react";
import useSWR from "swr";
import { CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";
import { useParams } from "next/navigation";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

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

export default function OnboardingTokenPage() {
  const params = useParams();
  const token = String(params?.token || "");

  const { data, error, isLoading, mutate } = useSWR(
    token ? `/api/onboarding/token/${token}` : null,
    fetcher
  );

  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  const opdracht: Opdracht | null = data?.opdracht || null;

  async function bevestig() {
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
      mutate();
    } catch (error) {
      setFout(`Bevestigen is niet gelukt: ${String(error)}`);
    } finally {
      setBezig(false);
    }
  }

  const titel = opdracht?.nummer
    ? `${opdracht.nummer}. ${opdracht.titel}`
    : opdracht?.titel;

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-3xl space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-2 inline-flex items-center rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">
            IJssalon Vincenzo onboarding
          </div>

          <h1 className="text-2xl font-bold text-slate-900">
            {titel || "Onboarding"}
          </h1>

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
            Deze onboardinglink kon niet worden geladen.
          </section>
        )}

        {data && !data.success && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm">
            {data.error || "Deze onboardinglink is niet geldig."}
          </section>
        )}

        {opdracht && (
          <>
            {opdracht.status === "afgerond" && (
              <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-800 shadow-sm">
                <div className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none" />
                  <div>
                    <div className="font-bold">Deze instructie is afgerond.</div>
                    <div className="mt-1 text-sm">
                      Je hoeft niets meer te doen.
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
                dangerouslySetInnerHTML={{ __html: opdracht.inhoud || "" }}
              />
            </section>

            {opdracht.status !== "afgerond" && (
              <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="font-bold text-slate-900">
                      Bevestig dat je deze instructie hebt gelezen
                    </div>
                    <p className="mt-1 text-sm text-slate-600">
                      Klik op de knop als je de instructie hebt gelezen en
                      begrepen. Later kunnen we hier ook controlevragen aan
                      toevoegen.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={bevestig}
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