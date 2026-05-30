// src/app/admin/mail-instellingen/page.tsx

"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Mail,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Users,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type MailSoort = {
  id: number;
  sleutel: string;
  naam: string;
  actief: boolean;
  alleen_versturen_bij_rooster: boolean;
  omschrijving: string | null;
};

type Ontvanger = {
  id: number;
  mail_soort_sleutel: string;
  naam: string | null;
  email: string;
  actief: boolean;
};

type MailInstellingenResponse = {
  success: boolean;
  data: {
    soort: MailSoort;
    ontvangers: Ontvanger[];
  };
  error?: string;
};

export default function MailInstellingenPage() {
  const { data, error, mutate, isLoading } = useSWR<MailInstellingenResponse>(
    "/api/admin/mail-instellingen",
    fetcher
  );

  const [naam, setNaam] = useState("");
  const [email, setEmail] = useState("");
  const [opslaan, setOpslaan] = useState(false);
  const [melding, setMelding] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  const soort = data?.data?.soort;
  const ontvangers = data?.data?.ontvangers || [];

  async function wijzigSoort(update: Partial<MailSoort>) {
    setMelding(null);
    setFout(null);

    const res = await fetch("/api/admin/mail-instellingen", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "soort",
        ...update,
      }),
    });

    const json = await res.json();

    if (!res.ok || !json.success) {
      setFout(json.error || "Mailinstelling kon niet worden gewijzigd.");
      return;
    }

    setMelding("Mailinstelling opgeslagen.");
    mutate();
  }

  async function voegOntvangerToe(e: React.FormEvent) {
    e.preventDefault();

    setOpslaan(true);
    setMelding(null);
    setFout(null);

    try {
      const res = await fetch("/api/admin/mail-instellingen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          naam,
          email,
          actief: true,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setFout(json.error || "Ontvanger kon niet worden toegevoegd.");
        return;
      }

      setNaam("");
      setEmail("");
      setMelding("Ontvanger toegevoegd.");
      mutate();
    } finally {
      setOpslaan(false);
    }
  }

  async function wijzigOntvanger(ontvanger: Ontvanger, update: Partial<Ontvanger>) {
    setMelding(null);
    setFout(null);

    const res = await fetch("/api/admin/mail-instellingen", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "ontvanger",
        id: ontvanger.id,
        ...update,
      }),
    });

    const json = await res.json();

    if (!res.ok || !json.success) {
      setFout(json.error || "Ontvanger kon niet worden gewijzigd.");
      return;
    }

    setMelding("Ontvanger bijgewerkt.");
    mutate();
  }

  async function verwijderOntvanger(ontvanger: Ontvanger) {
    const akkoord = window.confirm(
      `Weet je zeker dat je ${ontvanger.email} wilt verwijderen?`
    );

    if (!akkoord) return;

    setMelding(null);
    setFout(null);

    const res = await fetch(`/api/admin/mail-instellingen?id=${ontvanger.id}`, {
      method: "DELETE",
    });

    const json = await res.json();

    if (!res.ok || !json.success) {
      setFout(json.error || "Ontvanger kon niet worden verwijderd.");
      return;
    }

    setMelding("Ontvanger verwijderd.");
    mutate();
  }

  return (
    <main className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700">
                <Mail className="h-4 w-4" />
                Management mails
              </div>
              <h1 className="text-2xl font-bold text-slate-900">
                Mailinstellingen
              </h1>
              <p className="mt-1 text-sm text-slate-600">
                Beheer hier wie de dagbriefing ontvangt en of de mailfunctie
                actief is.
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
        </div>

        {isLoading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-slate-600 shadow-sm">
            Mailinstellingen laden...
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-red-800 shadow-sm">
            Mailinstellingen konden niet worden geladen.
          </div>
        )}

        {fout && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800 shadow-sm">
            {fout}
          </div>
        )}

        {melding && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 shadow-sm">
            {melding}
          </div>
        )}

        {soort && (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {soort.naam}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {soort.omschrijving}
                </p>
              </div>

              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  soort.actief
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {soort.actief ? "Actief" : "Uitgeschakeld"}
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => wijzigSoort({ actief: !soort.actief })}
                className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${
                  soort.actief
                    ? "border-emerald-200 bg-emerald-50 hover:bg-emerald-100"
                    : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                }`}
              >
                <div>
                  <div className="font-semibold text-slate-900">
                    Dagbriefing mailfunctie
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Zet de dagbriefing aan of uit.
                  </div>
                </div>
                {soort.actief ? (
                  <ToggleRight className="h-8 w-8 text-emerald-600" />
                ) : (
                  <ToggleLeft className="h-8 w-8 text-slate-400" />
                )}
              </button>

              <button
                type="button"
                onClick={() =>
                  wijzigSoort({
                    alleen_versturen_bij_rooster:
                      !soort.alleen_versturen_bij_rooster,
                  })
                }
                className={`flex items-center justify-between rounded-2xl border p-4 text-left transition ${
                  soort.alleen_versturen_bij_rooster
                    ? "border-blue-200 bg-blue-50 hover:bg-blue-100"
                    : "border-slate-200 bg-slate-50 hover:bg-slate-100"
                }`}
              >
                <div>
                  <div className="font-semibold text-slate-900">
                    Alleen bij dagrooster
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    Later bruikbaar voor automatisch versturen op openingsdagen.
                  </div>
                </div>
                {soort.alleen_versturen_bij_rooster ? (
                  <ToggleRight className="h-8 w-8 text-blue-600" />
                ) : (
                  <ToggleLeft className="h-8 w-8 text-slate-400" />
                )}
              </button>
            </div>

            {!soort.actief && (
              <div className="mt-4 flex gap-2 rounded-xl border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
                De dagbriefing-mailfunctie staat uit. Handmatige of automatische
                verzending kan dit straks respecteren.
              </div>
            )}
          </section>
        )}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">Ontvangers</h2>
          </div>

          <form
            onSubmit={voegOntvangerToe}
            className="mb-5 grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1fr_1.4fr_auto]"
          >
            <input
              value={naam}
              onChange={(e) => setNaam(e.target.value)}
              placeholder="Naam"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="E-mailadres"
              type="email"
              required
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <button
              type="submit"
              disabled={opslaan}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              Toevoegen
            </button>
          </form>

          {ontvangers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
              Nog geen ontvangers ingesteld.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full border-collapse bg-white text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                      Naam
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                      E-mail
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 font-semibold">
                      Status
                    </th>
                    <th className="border-b border-slate-200 px-4 py-3 text-right font-semibold">
                      Acties
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ontvangers.map((ontvanger) => (
                    <tr key={ontvanger.id} className="border-b border-slate-100">
                      <td className="px-4 py-3 text-slate-900">
                        {ontvanger.naam || "-"}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        {ontvanger.email}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                            ontvanger.actief
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {ontvanger.actief ? "Actief" : "Uit"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              wijzigOntvanger(ontvanger, {
                                actief: !ontvanger.actief,
                              })
                            }
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            {ontvanger.actief ? "Zet uit" : "Zet aan"}
                          </button>

                          <button
                            type="button"
                            onClick={() => verwijderOntvanger(ontvanger)}
                            className="inline-flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Verwijder
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}