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
    wachtwoord: "",
    geboortedatum: "",
  });
  const [fout, setFout] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);
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
  }, [succes]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFout(null);
    setSucces(false);

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
      setSucces(true);
      setForm({
        naam: "",
        email: "",
        functie: "",
        wachtwoord: "",
        geboortedatum: "",
      });
    } else {
      setFout(data.error || "Onbekende fout");
    }
  };

  const handleDelete = async (email: string) => {
    if (!confirm(`Verwijder medewerker met e-mail: ${email}?`)) return;

    await fetch(`/api/medewerkers?email=${encodeURIComponent(email)}`, {
      method: "DELETE",
    });

    setSucces(true);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <h1 className="text-2xl font-bold">👥 Medewerkersbeheer</h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded bg-gray-50 p-4 shadow"
      >
        <div className="grid grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Naam"
            className="rounded border p-2"
            value={form.naam}
            onChange={(e) => setForm({ ...form, naam: e.target.value })}
            required
          />

          <input
            type="email"
            placeholder="E-mailadres"
            className="rounded border p-2"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />

          <input
            type="date"
            className="rounded border p-2"
            value={form.geboortedatum}
            onChange={(e) =>
              setForm({ ...form, geboortedatum: e.target.value })
            }
          />

          <select
            className="rounded border p-2"
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

          <input
            type="text"
            placeholder="Tijdelijk wachtwoord"
            className="rounded border p-2"
            value={form.wachtwoord}
            onChange={(e) => setForm({ ...form, wachtwoord: e.target.value })}
            required
          />
        </div>

        <button
          type="submit"
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
        >
          Medewerker toevoegen
        </button>

        {fout && <p className="text-red-600">❌ {fout}</p>}
        {succes && <p className="text-green-700">✅ Toegevoegd</p>}
      </form>

      <div className="rounded bg-white p-4 shadow">
        <h2 className="mb-2 text-lg font-semibold">Bestaande medewerkers</h2>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2 text-left">Naam</th>
              <th className="border p-2 text-left">E-mail</th>
              <th className="border p-2 text-left">Functie</th>
              <th className="border p-2 text-left">Geboortedatum</th>
              <th className="border p-2 text-center">Actie</th>
            </tr>
          </thead>
          <tbody>
            {medewerkers.map((m) => (
              <tr key={m.id}>
                <td className="border p-2">{m.naam}</td>
                <td className="border p-2">{m.email}</td>
                <td className="border p-2">{m.functie}</td>
                <td className="border p-2">{formatDateNl(m.geboortedatum)}</td>
                <td className="space-x-2 border p-2 text-center">
                  <button
                    onClick={() => {
                      setGeselecteerde(m);
                      setModalOpen(true);
                    }}
                    className="text-blue-600 hover:text-blue-800"
                    title="Bewerken"
                  >
                    ✏️
                  </button>

                  <button
                    onClick={() => handleDelete(m.email)}
                    className="text-red-600 hover:text-red-800"
                    title="Verwijderen"
                  >
                    ❌
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {geselecteerde && (
        <BewerkMedewerkerModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          medewerker={geselecteerde}
          functies={functies}
          onSave={async (gewijzigd) => {
            const res = await fetch("/api/medewerkers", {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(gewijzigd),
            });

            if (res.ok) {
              setSucces(true);
            }
          }}
        />
      )}

      <ScrollToTopButton />
    </div>
  );
}