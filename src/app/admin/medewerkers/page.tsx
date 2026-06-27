"use client";

import { useEffect, useState } from "react";

import BewerkMedewerkerModal from "@/components/BewerkMedewerkerModal";
import ScrollToTopButton from "@/components/ScrollToTopButton";

export const dynamic = "force-dynamic";

interface Medewerker {
  id: number;
  naam: string;
  email: string;
  functie: string;
  geboortedatum: string | null;
}

interface FunctieOptie {
  id: number;
  naam: string;
}

function formatDateNl(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("nl-NL");
}

export default function MedewerkersBeheer() {
  const [medewerkers, setMedewerkers] = useState<Medewerker[]>([]);
  const [functies, setFuncties] = useState<FunctieOptie[]>([]);
  const [form, setForm] = useState({
    naam: "",
    email: "",
    functie: "",
    geboortedatum: "",
  });

  const [fout, setFout] = useState<string | null>(null);
  const [succesMelding, setSuccesMelding] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [geselecteerde, setGeselecteerde] = useState<Medewerker | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const naam = params.get("naam") || "";
    const email = params.get("email") || "";
    const geboortedatum = params.get("geboortedatum") || "";

    if (naam || email || geboortedatum) {
      setForm((prev) => ({
        ...prev,
        naam,
        email,
        geboortedatum: geboortedatum.slice(0, 10),
      }));
    }
  }, []);

  useEffect(() => {
    fetch("/api/medewerkers")
      .then((res) => res.json())
      .then((data) => setMedewerkers(data));

    fetch("/api/medewerkers?type=functies")
      .then((res) => res.json())
      .then((data) => setFuncties(data));
  }, [refreshKey]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFout(null);
    setSuccesMelding(null);

    const res = await fetch("/api/medewerkers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        geboortedatum: form.geboortedatum || null,
      }),
    });

    const data = await res.json();

    if (res.ok) {
      if (data.mailVerstuurd === false) {
        setSuccesMelding(
          "Medewerker toegevoegd, maar de welkomstmail is niet verzonden."
        );
      } else {
        setSuccesMelding("Medewerker toegevoegd en welkomstmail verzonden.");
      }

      setForm({
        naam: "",
        email: "",
        functie: "",
        geboortedatum: "",
      });

      setRefreshKey((prev) => prev + 1);
    } else {
      setFout(data.error || "Onbekende fout");
    }
  };

  const handleDelete = async (email: string) => {
    if (!confirm(`Verwijder medewerker met e-mail: ${email}?`)) return;

    setFout(null);
    setSuccesMelding(null);

    const res = await fetch(`/api/medewerkers?email=${encodeURIComponent(email)}`, {
      method: "DELETE",
    });

    if (res.ok) {
      setSuccesMelding("Medewerker verwijderd.");
      setRefreshKey((prev) => prev + 1);
    } else {
      setFout("Verwijderen mislukt.");
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
      <div className="space-y-2">
        <p className="text-sm font-medium text-blue-700">Medewerkers</p>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Medewerkersbeheer
        </h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Voeg nieuwe medewerkers toe, beheer basisgegevens en start automatisch
          de juiste welkomstflow.
        </p>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-slate-900">
            Nieuwe medewerker toevoegen
          </h2>
          <p className="text-sm text-slate-500">
            De medewerker ontvangt na toevoegen een welkomstmail. Inloggen met
            wachtwoord is niet meer nodig.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Naam</span>
              <input
                type="text"
                placeholder="Naam medewerker"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                value={form.naam}
                onChange={(e) => setForm({ ...form, naam: e.target.value })}
                required
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                E-mailadres
              </span>
              <input
                type="email"
                placeholder="naam@example.com"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">
                Geboortedatum
              </span>
              <input
                type="date"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                value={form.geboortedatum}
                onChange={(e) =>
                  setForm({ ...form, geboortedatum: e.target.value })
                }
              />
            </label>

            <label className="space-y-1">
              <span className="text-sm font-medium text-slate-700">Functie</span>
              <select
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
                value={form.functie}
                onChange={(e) => setForm({ ...form, functie: e.target.value })}
                required
              >
                <option value="">Kies functie</option>
                {functies.map((f) => (
                  <option key={f.id} value={f.naam}>
                    {f.naam}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-2xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
            >
              Medewerker toevoegen
            </button>

            {fout && (
              <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                ❌ {fout}
              </p>
            )}

            {succesMelding && (
              <p
                className={
                  succesMelding.includes("niet verzonden")
                    ? "rounded-2xl bg-orange-50 px-4 py-3 text-sm font-medium text-orange-700"
                    : "rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
                }
              >
                {succesMelding.includes("niet verzonden") ? "⚠️" : "✅"}{" "}
                {succesMelding}
              </p>
            )}
          </div>
        </form>
      </section>

      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4 sm:px-6">
          <h2 className="text-lg font-semibold text-slate-900">
            Bestaande medewerkers
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Overzicht van alle medewerkers die in het systeem staan.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-5 py-3">Naam</th>
                <th className="px-5 py-3">E-mail</th>
                <th className="px-5 py-3">Functie</th>
                <th className="px-5 py-3">Geboortedatum</th>
                <th className="px-5 py-3 text-right">Actie</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {medewerkers.map((m) => (
                <tr key={m.id} className="transition hover:bg-slate-50">
                  <td className="px-5 py-4 font-medium text-slate-900">
                    {m.naam}
                  </td>
                  <td className="px-5 py-4 text-slate-600">{m.email}</td>
                  <td className="px-5 py-4">
                    <span className="inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      {m.functie}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-600">
                    {formatDateNl(m.geboortedatum)}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setGeselecteerde(m);
                          setModalOpen(true);
                        }}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-700 transition hover:bg-blue-100"
                        title="Bewerken"
                      >
                        ✏️
                      </button>

                      <button
                        onClick={() => handleDelete(m.email)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-red-50 text-red-700 transition hover:bg-red-100"
                        title="Verwijderen"
                      >
                        ❌
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {medewerkers.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-10 text-center text-sm text-slate-500"
                  >
                    Er zijn nog geen medewerkers gevonden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {geselecteerde && (
        <BewerkMedewerkerModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          medewerker={geselecteerde}
          functies={functies}
          onSave={async (gewijzigd) => {
            setFout(null);
            setSuccesMelding(null);

            const res = await fetch("/api/medewerkers", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(gewijzigd),
            });

            if (res.ok) {
              setSuccesMelding("Medewerker bijgewerkt.");
              setModalOpen(false);
              setRefreshKey((prev) => prev + 1);
            } else {
              setFout("Bijwerken mislukt.");
            }
          }}
        />
      )}

      <ScrollToTopButton />
    </div>
  );
}