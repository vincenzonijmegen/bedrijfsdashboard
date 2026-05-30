"use client";

import useSWR from "swr";
import Link from "next/link";
import { useMemo, useState } from "react";

interface Medewerker {
  id: number;
  email: string;
  naam: string;
  functie: string;
}

interface Instructiestatus {
  email: string;
  gelezen: number;
  totaal: number;
  geslaagd: number;
}

interface Skillstatus {
  email: string;
  learned: number;
  total: number;
}

interface Data {
  medewerkers: Medewerker[];
  instructiestatus: Instructiestatus[];
  skillsstatus: Skillstatus[];
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

const voortgangClass = (gedaan: number, totaal: number) => {
  if (totaal === 0) return "bg-slate-100 text-slate-500 border-slate-200";
  if (gedaan === 0) return "bg-rose-50 text-rose-700 border-rose-200";
  if (gedaan < totaal) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-emerald-50 text-emerald-700 border-emerald-200";
};

const voortgangTekst = (gedaan: number, totaal: number) => {
  if (totaal === 0) return "Niet van toepassing";
  if (gedaan === 0) return "Nog niet gestart";
  if (gedaan < totaal) return "Nog niet klaar";
  return "Compleet";
};

export default function OverzichtProgressiePagina() {
  const { data, error } = useSWR<Data>(
    "/api/rapportages/medewerkers/overzicht-progressie",
    fetcher
  );

  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);

  const instrMap = useMemo(() => {
    if (!data?.instructiestatus) return {} as Record<string, Instructiestatus>;
    return Object.fromEntries(data.instructiestatus.map((r) => [r.email, r]));
  }, [data?.instructiestatus]);

  const skillsMap = useMemo(() => {
    if (!data?.skillsstatus) return {} as Record<string, Skillstatus>;
    return Object.fromEntries(data.skillsstatus.map((r) => [r.email, r]));
  }, [data?.skillsstatus]);

  const mailbareMedewerkers = useMemo(() => {
    if (!data?.medewerkers) return [];

    return data.medewerkers.filter((m) => {
      const i = instrMap[m.email] || { gelezen: 0, totaal: 0, geslaagd: 0 };
      return i.totaal > 0 && i.gelezen < i.totaal;
    });
  }, [data?.medewerkers, instrMap]);

  const toggleSelect = (email: string) => {
    setSelectedEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  const toggleSelectAll = () => {
    const alleMailbareEmails = mailbareMedewerkers.map((m) => m.email);
    const allesGeselecteerd = alleMailbareEmails.every((email) =>
      selectedEmails.includes(email)
    );

    setSelectedEmails(allesGeselecteerd ? [] : alleMailbareEmails);
  };

  const handleMailClick = async () => {
    if (selectedEmails.length === 0 || isSending) return;

    setIsSending(true);

    try {
      const res = await fetch("/api/admin/mail/herinnering", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails: selectedEmails,
          cc: ["herman@ijssalonvincenzo.nl"],
          onderwerp: "Herinnering werkinstructies",
          tekst: `Beste {voornaam},\n\nJe hebt nog niet alle werkinstructies gelezen. Wil je dit z.s.m. doen?\n\nGa naar: https://werkinstructies-app.vercel.app\n\nMet vriendelijke groet,\nTeam IJssalon Vincenzo`,
        }),
      });

      if (!res.ok) {
        throw new Error("Mail kon niet worden verzonden");
      }

      alert(`Herinneringsmail verzonden naar ${selectedEmails.length} medewerker(s).\nCC: herman@ijssalonvincenzo.nl`);
      setSelectedEmails([]);
    } catch (err) {
      console.error("Fout bij verzenden herinneringsmail:", err);
      alert("Fout bij verzenden van de herinneringsmail.");
    } finally {
      setIsSending(false);
    }
  };

  if (error) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="rounded-2xl border border-rose-200 bg-white p-6 text-rose-700 shadow-sm">
          Fout bij laden rapportage
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
          Laden...
        </div>
      </main>
    );
  }

  if (
    !Array.isArray(data.medewerkers) ||
    !Array.isArray(data.instructiestatus) ||
    !Array.isArray(data.skillsstatus)
  ) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="rounded-2xl border border-amber-200 bg-white p-6 text-amber-700 shadow-sm">
          Onvolledige data ontvangen
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <Link
                href="/admin/rapportages/medewerkers"
                className="text-sm font-medium text-blue-600 hover:text-blue-700 hover:underline"
              >
                ← Terug naar Rapportage Medewerkers
              </Link>
              <h1 className="mt-3 text-2xl font-bold text-slate-900">
                Overzicht progressie
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Selecteer medewerkers die nog niet alle werkinstructies hebben gelezen.
              </p>
            </div>

            <button
              onClick={handleMailClick}
              disabled={selectedEmails.length === 0 || isSending}
              className="inline-flex items-center justify-center rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
            >
              {isSending
                ? "Mail wordt verzonden..."
                : `Mail geselecteerde medewerkers (${selectedEmails.length})`}
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Medewerkers
              </div>
              <div className="mt-1 text-2xl font-bold text-slate-900">
                {data.medewerkers.length}
              </div>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                Nog niet klaar
              </div>
              <div className="mt-1 text-2xl font-bold text-amber-800">
                {mailbareMedewerkers.length}
              </div>
            </div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                Geselecteerd
              </div>
              <div className="mt-1 text-2xl font-bold text-blue-800">
                {selectedEmails.length}
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="text-sm text-slate-600">
              Alleen medewerkers met openstaande instructies kunnen worden geselecteerd.
            </div>
            <button
              type="button"
              onClick={toggleSelectAll}
              disabled={mailbareMedewerkers.length === 0}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {mailbareMedewerkers.length > 0 &&
              mailbareMedewerkers.every((m) => selectedEmails.includes(m.email))
                ? "Selectie wissen"
                : "Selecteer alle openstaande"}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] table-auto border-collapse text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-28 border-b border-slate-200 px-4 py-3 text-center">
                    Selecteer
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left">
                    Naam
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-left">
                    Functie
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-center">
                    Instructies
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-center">
                    Geslaagd
                  </th>
                  <th className="border-b border-slate-200 px-4 py-3 text-center">
                    Skills
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.medewerkers.map((m) => {
                  const i = instrMap[m.email] || {
                    gelezen: 0,
                    totaal: 0,
                    geslaagd: 0,
                  };
                  const s = skillsMap[m.email] || { learned: 0, total: 0 };
                  const magGeselecteerd = i.totaal > 0 && i.gelezen < i.totaal;

                  return (
                    <tr key={m.email} className="transition hover:bg-slate-50">
                      <td className="px-4 py-3 text-center">
                        {magGeselecteerd ? (
                          <input
                            type="checkbox"
                            checked={selectedEmails.includes(m.email)}
                            onChange={() => toggleSelect(m.email)}
                            className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-600"
                            aria-label={`Selecteer ${m.naam}`}
                          />
                        ) : (
                          <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500">
                            klaar
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/medewerker/${encodeURIComponent(
                            m.email
                          )}/dashboard`}
                          className="font-medium text-blue-600 hover:text-blue-700 hover:underline"
                        >
                          {m.naam}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{m.functie}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex min-w-[118px] flex-col rounded-xl border px-3 py-2 font-semibold ${voortgangClass(
                            i.gelezen,
                            i.totaal
                          )}`}
                        >
                          <span>
                            {i.gelezen} / {i.totaal}
                          </span>
                          <span className="mt-0.5 text-[11px] font-medium">
                            {voortgangTekst(i.gelezen, i.totaal)}
                          </span>
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-medium text-slate-700">
                        {i.geslaagd}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex min-w-[92px] rounded-xl border px-3 py-2 font-semibold ${voortgangClass(
                            s.learned,
                            s.total
                          )}`}
                        >
                          {s.learned} / {s.total}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
