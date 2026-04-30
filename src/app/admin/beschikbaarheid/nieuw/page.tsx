"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  Loader2,
  Save,
  UserRound,
} from "lucide-react";

const dagen = [
  "maandag",
  "dinsdag",
  "woensdag",
  "donderdag",
  "vrijdag",
  "zaterdag",
  "zondag",
];

interface Medewerker {
  id: number;
  naam: string;
}

export default function NieuwBeschikbaarheidFormulier() {
  const [medewerkers, setMedewerkers] = useState<Medewerker[]>([]);
  const [medewerkerId, setMedewerkerId] = useState<number | null>(null);
  const [startdatum, setStartdatum] = useState("");
  const [einddatum, setEinddatum] = useState("");
  const [maxShifts, setMaxShifts] = useState(2);
  const [shifts, setShifts] = useState<
    Record<string, { s1: boolean; s2: boolean }>
  >({
    maandag: { s1: false, s2: false },
    dinsdag: { s1: false, s2: false },
    woensdag: { s1: false, s2: false },
    donderdag: { s1: false, s2: false },
    vrijdag: { s1: false, s2: false },
    zaterdag: { s1: false, s2: false },
    zondag: { s1: false, s2: false },
  });
  const [opmerking, setOpmerking] = useState("");
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/medewerkers")
      .then((res) => res.json())
      .then((data) => setMedewerkers(data));
  }, []);

  const toggle = (dag: string, shift: "s1" | "s2") => {
    setShifts((prev) => ({
      ...prev,
      [dag]: { ...prev[dag], [shift]: !prev[dag][shift] },
    }));
  };

  const handleSubmit = async () => {
    if (!startdatum || !einddatum || !medewerkerId) {
      alert("Alle velden zijn verplicht");
      return;
    }

    setUploading(true);

    const res = await fetch("/api/beschikbaarheid", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        medewerker_id: medewerkerId,
        startdatum,
        einddatum,
        max_shifts_per_week: maxShifts,
        opmerkingen: opmerking,
        bron: "beheer",
        ...Object.fromEntries(
          dagen.flatMap((dag) => [
            [`${dag}_1`, shifts[dag].s1],
            [`${dag}_2`, shifts[dag].s2],
          ])
        ),
      }),
    });

    if (res.ok) {
      router.push("/admin/beschikbaarheid");
    } else {
      alert("Opslaan mislukt");
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
              <CalendarDays className="h-6 w-6" />
            </div>

            <div>
              <div className="mb-1 text-sm font-medium text-blue-600">
                Planning / Beschikbaarheid
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Nieuwe beschikbaarheid invoeren
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Leg beschikbaarheid per medewerker vast voor een bepaalde periode.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <main className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600 ring-1 ring-blue-100">
                  <UserRound size={20} />
                </div>

                <div>
                  <h2 className="text-lg font-bold text-slate-950">
                    Medewerker en periode
                  </h2>
                  <p className="text-sm text-slate-500">
                    Kies voor wie deze beschikbaarheid geldt.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <label className="md:col-span-2">
                  <span className="mb-1 block text-sm font-semibold text-slate-700">
                    Medewerker
                  </span>
                  <select
                    value={medewerkerId !== null ? medewerkerId : ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setMedewerkerId(val ? Number(val) : null);
                    }}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="">-- Kies een medewerker --</option>
                    {medewerkers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.naam}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  <span className="mb-1 block text-sm font-semibold text-slate-700">
                    Startdatum
                  </span>
                  <input
                    type="date"
                    value={startdatum}
                    onChange={(e) => setStartdatum(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label>
                  <span className="mb-1 block text-sm font-semibold text-slate-700">
                    Einddatum
                  </span>
                  <input
                    type="date"
                    value={einddatum}
                    onChange={(e) => setEinddatum(e.target.value)}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="md:col-span-2">
                  <span className="mb-1 block text-sm font-semibold text-slate-700">
                    Maximaal aantal shifts per week
                  </span>
                  <input
                    type="number"
                    value={maxShifts}
                    onChange={(e) => setMaxShifts(Number(e.target.value))}
                    min={1}
                    max={14}
                    className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
                <h2 className="text-lg font-bold text-slate-950">
                  Beschikbaarheid per dag
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Vink per dag aan voor welke shift de medewerker beschikbaar is.
                </p>
              </div>

              <div className="divide-y divide-slate-100">
                {dagen.map((dag) => {
                  const s1 = shifts[dag].s1;
                  const s2 = shifts[dag].s2;

                  return (
                    <div
                      key={dag}
                      className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-5 py-3"
                    >
                      <div className="font-semibold capitalize text-slate-900">
                        {dag}
                      </div>

                      <button
                        type="button"
                        onClick={() => toggle(dag, "s1")}
                        className={`inline-flex min-w-[100px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ring-1 transition ${
                          s1
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : "bg-slate-50 text-slate-500 ring-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {s1 && <CheckCircle2 size={15} />}
                        Shift 1
                      </button>

                      <button
                        type="button"
                        onClick={() => toggle(dag, "s2")}
                        className={`inline-flex min-w-[100px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold ring-1 transition ${
                          s2
                            ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                            : "bg-slate-50 text-slate-500 ring-slate-200 hover:bg-slate-100"
                        }`}
                      >
                        {s2 && <CheckCircle2 size={15} />}
                        Shift 2
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          </main>

          <aside className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">Opmerking</h2>
              <p className="mt-1 text-sm text-slate-500">
                Optioneel, bijvoorbeeld schoolrooster of bijzonderheden.
              </p>

              <textarea
                value={opmerking}
                onChange={(e) => setOpmerking(e.target.value)}
                className="mt-4 min-h-[160px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                placeholder="Bijzonderheden..."
              />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <button
                disabled={uploading}
                onClick={handleSubmit}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Bezig met opslaan...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Opslaan
                  </>
                )}
              </button>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}