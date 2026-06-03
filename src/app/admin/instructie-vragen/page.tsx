"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type InstructieOverzicht = {
  id: string;
  nummer: string | null;
  titel: string;
  status: string;
  onboarding_verplicht: boolean;
  onboarding_fase: string;
  onboarding_volgorde: number;
  aantal_vragen: number;
};

type Optie = {
  id?: string;
  vraag_id?: string;
  tekst: string;
  is_correct: boolean;
  sortering: number;
};

type Vraag = {
  id?: string;
  instructie_id: string;
  vraag: string;
  uitleg: string | null;
  type: "multiple_choice" | "bevestiging";
  verplicht: boolean;
  sortering: number;
  actief?: boolean;
  opties: Optie[];
};

type InstructieDetail = {
  instructie: {
    id: string;
    nummer: string | null;
    titel: string;
    slug: string;
    inhoud: string;
    status: string;
    onboarding_verplicht: boolean;
    onboarding_fase: string;
    onboarding_volgorde: number;
  };
  vragen: Vraag[];
};

function faseLabel(fase: string) {
  switch (fase) {
    case "voor_eerste_shift":
      return "Voor eerste shift";
    case "binnen_2_weken":
      return "Binnen 2 weken";
    case "taakgericht":
      return "Taakgericht";
    default:
      return fase || "-";
  }
}

function nieuweVraag(instructieId: string, sortering: number): Vraag {
  return {
    instructie_id: instructieId,
    vraag: "",
    uitleg: "",
    type: "multiple_choice",
    verplicht: true,
    sortering,
    opties: [
      {
        tekst: "",
        is_correct: true,
        sortering: 10,
      },
      {
        tekst: "",
        is_correct: false,
        sortering: 20,
      },
      {
        tekst: "",
        is_correct: false,
        sortering: 30,
      },
    ],
  };
}

export default function InstructieVragenPage() {
  const {
    data: overzichtData,
    error: overzichtError,
    isLoading: overzichtLoading,
    mutate: mutateOverzicht,
  } = useSWR("/api/admin/instructie-vragen", fetcher);

  const instructies: InstructieOverzicht[] = overzichtData?.instructies || [];

  const [zoekterm, setZoekterm] = useState("");
  const [geselecteerdeId, setGeselecteerdeId] = useState<string | null>(null);
  const [bewerkVraag, setBewerkVraag] = useState<Vraag | null>(null);
  const [melding, setMelding] = useState<string | null>(null);
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, setBezig] = useState(false);

  const detailUrl = geselecteerdeId
    ? `/api/admin/instructie-vragen?instructie_id=${geselecteerdeId}`
    : null;

  const {
    data: detailData,
    error: detailError,
    isLoading: detailLoading,
    mutate: mutateDetail,
  } = useSWR(detailUrl, fetcher);

  const detail: InstructieDetail | null = detailData?.data || null;

  const gefilterdeInstructies = useMemo(() => {
    const zoek = zoekterm.trim().toLowerCase();

    if (!zoek) return instructies;

    return instructies.filter((instructie) => {
      return (
        instructie.titel?.toLowerCase().includes(zoek) ||
        instructie.nummer?.toLowerCase().includes(zoek) ||
        faseLabel(instructie.onboarding_fase).toLowerCase().includes(zoek)
      );
    });
  }, [instructies, zoekterm]);

  function selecteerInstructie(id: string) {
    setGeselecteerdeId(id);
    setBewerkVraag(null);
    setMelding(null);
    setFout(null);
  }

  function startNieuweVraag() {
    if (!detail?.instructie?.id) return;

    const hoogsteSortering =
      detail.vragen.length > 0
        ? Math.max(...detail.vragen.map((vraag) => Number(vraag.sortering || 0)))
        : 0;

    setBewerkVraag(nieuweVraag(detail.instructie.id, hoogsteSortering + 10));
    setMelding(null);
    setFout(null);
  }

  function startBewerken(vraag: Vraag) {
    setBewerkVraag({
      ...vraag,
      uitleg: vraag.uitleg || "",
      opties:
        vraag.opties.length > 0
          ? vraag.opties.map((optie) => ({ ...optie }))
          : [
              { tekst: "", is_correct: true, sortering: 10 },
              { tekst: "", is_correct: false, sortering: 20 },
            ],
    });
    setMelding(null);
    setFout(null);
  }

  function updateVraagField<K extends keyof Vraag>(key: K, value: Vraag[K]) {
    if (!bewerkVraag) return;

    setBewerkVraag({
      ...bewerkVraag,
      [key]: value,
    });
  }

  function updateOptie(index: number, patch: Partial<Optie>) {
    if (!bewerkVraag) return;

    const opties = bewerkVraag.opties.map((optie, optieIndex) => {
      if (optieIndex !== index) return optie;

      return {
        ...optie,
        ...patch,
      };
    });

    setBewerkVraag({
      ...bewerkVraag,
      opties,
    });
  }

  function markeerCorrect(index: number) {
    if (!bewerkVraag) return;

    setBewerkVraag({
      ...bewerkVraag,
      opties: bewerkVraag.opties.map((optie, optieIndex) => ({
        ...optie,
        is_correct: optieIndex === index,
      })),
    });
  }

  function voegOptieToe() {
    if (!bewerkVraag) return;

    const hoogsteSortering =
      bewerkVraag.opties.length > 0
        ? Math.max(...bewerkVraag.opties.map((optie) => Number(optie.sortering || 0)))
        : 0;

    setBewerkVraag({
      ...bewerkVraag,
      opties: [
        ...bewerkVraag.opties,
        {
          tekst: "",
          is_correct: false,
          sortering: hoogsteSortering + 10,
        },
      ],
    });
  }

  function verwijderOptie(index: number) {
    if (!bewerkVraag) return;

    const opties = bewerkVraag.opties.filter((_, optieIndex) => optieIndex !== index);

    if (opties.length === 0) {
      setBewerkVraag({
        ...bewerkVraag,
        opties: [],
      });
      return;
    }

    const heeftCorrect = opties.some((optie) => optie.is_correct);

    setBewerkVraag({
      ...bewerkVraag,
      opties: heeftCorrect
        ? opties
        : opties.map((optie, optieIndex) => ({
            ...optie,
            is_correct: optieIndex === 0,
          })),
    });
  }

  async function slaVraagOp() {
    if (!bewerkVraag) return;

    setBezig(true);
    setMelding(null);
    setFout(null);

    try {
      const res = await fetch("/api/admin/instructie-vragen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actie: "opslaan_vraag",
          ...bewerkVraag,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setFout(json.error || "Vraag opslaan mislukt.");
        return;
      }

      setMelding("Vraag opgeslagen.");
      setBewerkVraag(null);
      mutateDetail();
      mutateOverzicht();
    } catch (error) {
      setFout(`Vraag opslaan mislukt: ${String(error)}`);
    } finally {
      setBezig(false);
    }
  }

  async function verwijderVraag(vraag: Vraag) {
    if (!vraag.id) return;

    const akkoord = window.confirm(
      `Weet je zeker dat je deze vraag wilt verwijderen?\n\n${vraag.vraag}`
    );

    if (!akkoord) return;

    setBezig(true);
    setMelding(null);
    setFout(null);

    try {
      const res = await fetch("/api/admin/instructie-vragen", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          actie: "verwijder_vraag",
          id: vraag.id,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        setFout(json.error || "Vraag verwijderen mislukt.");
        return;
      }

      setMelding("Vraag verwijderd.");
      setBewerkVraag(null);
      mutateDetail();
      mutateOverzicht();
    } catch (error) {
      setFout(`Vraag verwijderen mislukt: ${String(error)}`);
    } finally {
      setBezig(false);
    }
  }

  const geselecteerdeInstructie = instructies.find(
    (instructie) => instructie.id === geselecteerdeId
  );

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
                <ClipboardList className="h-4 w-4" />
                Onboarding toetsen
              </div>

              <h1 className="text-2xl font-bold text-slate-900">
                Instructievragen beheren
              </h1>

              <p className="mt-1 text-sm text-slate-600">
                Beheer de toetsvragen en antwoordopties los van de instructietekst.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                mutateOverzicht();
                mutateDetail();
              }}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <RefreshCw className="h-4 w-4" />
              Vernieuwen
            </button>
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

        <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
          <aside className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="mb-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  value={zoekterm}
                  onChange={(e) => setZoekterm(e.target.value)}
                  placeholder="Zoek instructie..."
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>

            {overzichtLoading && (
              <div className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
                Instructies laden...
              </div>
            )}

            {overzichtError && (
              <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                Instructies konden niet worden geladen.
              </div>
            )}

            <div className="space-y-2">
              {gefilterdeInstructies.map((instructie) => {
                const actief = instructie.id === geselecteerdeId;

                return (
                  <button
                    key={instructie.id}
                    type="button"
                    onClick={() => selecteerInstructie(instructie.id)}
                    className={`w-full rounded-xl border p-3 text-left transition ${
                      actief
                        ? "border-blue-300 bg-blue-50"
                        : "border-slate-200 bg-white hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">
                          {instructie.nummer ? `${instructie.nummer}. ` : ""}
                          {instructie.titel}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {faseLabel(instructie.onboarding_fase)}
                          {instructie.onboarding_verplicht
                            ? " · verplicht"
                            : " · niet verplicht"}
                        </div>
                      </div>

                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                          instructie.aantal_vragen > 0
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {instructie.aantal_vragen}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="space-y-5">
            {!geselecteerdeId && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
                Kies links een instructie om de vragen te beheren.
              </div>
            )}

            {geselecteerdeId && detailLoading && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
                Vragen laden...
              </div>
            )}

            {geselecteerdeId && detailError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-800 shadow-sm">
                Vragen konden niet worden geladen.
              </div>
            )}

            {detail && (
              <>
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-slate-900">
                        {detail.instructie.nummer
                          ? `${detail.instructie.nummer}. `
                          : ""}
                        {detail.instructie.titel}
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        {faseLabel(detail.instructie.onboarding_fase)} ·{" "}
                        {detail.instructie.onboarding_verplicht
                          ? "verplicht"
                          : "niet verplicht"}{" "}
                        · {detail.vragen.length} vraag/vragen
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={startNieuweVraag}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4" />
                      Vraag toevoegen
                    </button>
                  </div>
                </div>

                {detail.vragen.length === 0 && !bewerkVraag && (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
                    Deze instructie heeft nog geen toetsvragen. De medewerker krijgt
                    dan alleen de knop “Ik heb dit gelezen en begrepen”.
                  </div>
                )}

                {detail.vragen.length > 0 && (
                  <div className="space-y-3">
                    {detail.vragen.map((vraag, index) => (
                      <div
                        key={vraag.id}
                        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="text-sm font-semibold text-slate-500">
                              Vraag {index + 1} · sortering {vraag.sortering}
                            </div>
                            <h3 className="mt-1 font-bold text-slate-900">
                              {vraag.vraag}
                            </h3>
                            {vraag.uitleg && (
                              <p className="mt-1 text-sm text-slate-600">
                                {vraag.uitleg}
                              </p>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => startBewerken(vraag)}
                              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              Bewerken
                            </button>

                            <button
                              type="button"
                              onClick={() => verwijderVraag(vraag)}
                              className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                              Verwijderen
                            </button>
                          </div>
                        </div>

                        {vraag.type === "multiple_choice" && (
                          <div className="mt-4 space-y-2">
                            {vraag.opties.map((optie) => (
                              <div
                                key={optie.id}
                                className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${
                                  optie.is_correct
                                    ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                                    : "border-slate-200 bg-slate-50 text-slate-700"
                                }`}
                              >
                                {optie.is_correct ? (
                                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-emerald-600" />
                                ) : (
                                  <XCircle className="mt-0.5 h-4 w-4 flex-none text-slate-400" />
                                )}
                                <span>{optie.tekst}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {bewerkVraag && (
                  <div className="rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">
                          {bewerkVraag.id ? "Vraag bewerken" : "Nieuwe vraag"}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          Vul de vraag en antwoordopties in. Er mag precies één
                          correct antwoord zijn.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => setBewerkVraag(null)}
                        className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        Annuleren
                      </button>
                    </div>

                    <div className="space-y-4">
                      <label className="block">
                        <span className="text-sm font-semibold text-slate-700">
                          Vraag
                        </span>
                        <textarea
                          value={bewerkVraag.vraag}
                          onChange={(e) =>
                            updateVraagField("vraag", e.target.value)
                          }
                          rows={3}
                          className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </label>

                      <label className="block">
                        <span className="text-sm font-semibold text-slate-700">
                          Uitleg / toelichting optioneel
                        </span>
                        <textarea
                          value={bewerkVraag.uitleg || ""}
                          onChange={(e) =>
                            updateVraagField("uitleg", e.target.value)
                          }
                          rows={2}
                          className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                        />
                      </label>

                      <div className="grid gap-3 md:grid-cols-3">
                        <label className="block">
                          <span className="text-sm font-semibold text-slate-700">
                            Type
                          </span>
                          <select
                            value={bewerkVraag.type}
                            onChange={(e) =>
                              updateVraagField(
                                "type",
                                e.target.value as Vraag["type"]
                              )
                            }
                            className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          >
                            <option value="multiple_choice">
                              Multiple choice
                            </option>
                            <option value="bevestiging">Bevestiging</option>
                          </select>
                        </label>

                        <label className="block">
                          <span className="text-sm font-semibold text-slate-700">
                            Sortering
                          </span>
                          <input
                            type="number"
                            value={bewerkVraag.sortering}
                            onChange={(e) =>
                              updateVraagField(
                                "sortering",
                                Number(e.target.value)
                              )
                            }
                            className="mt-1 w-full rounded-xl border border-slate-200 p-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          />
                        </label>

                        <label className="mt-7 flex items-center gap-2 text-sm font-semibold text-slate-700">
                          <input
                            type="checkbox"
                            checked={bewerkVraag.verplicht}
                            onChange={(e) =>
                              updateVraagField("verplicht", e.target.checked)
                            }
                            className="h-4 w-4 rounded border-slate-300"
                          />
                          Verplicht
                        </label>
                      </div>

                      {bewerkVraag.type === "multiple_choice" && (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                              <h4 className="font-bold text-slate-900">
                                Antwoordopties
                              </h4>
                              <p className="text-sm text-slate-600">
                                Vink het juiste antwoord aan.
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={voegOptieToe}
                              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              <Plus className="h-4 w-4" />
                              Optie
                            </button>
                          </div>

                          <div className="space-y-3">
                            {bewerkVraag.opties.map((optie, index) => (
                              <div
                                key={`${optie.id || "nieuw"}-${index}`}
                                className="rounded-xl border border-slate-200 bg-white p-3"
                              >
                                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 md:w-28">
                                    <input
                                      type="radio"
                                      name="correct-antwoord"
                                      checked={optie.is_correct}
                                      onChange={() => markeerCorrect(index)}
                                      className="h-4 w-4"
                                    />
                                    Correct
                                  </label>

                                  <input
                                    value={optie.tekst}
                                    onChange={(e) =>
                                      updateOptie(index, {
                                        tekst: e.target.value,
                                      })
                                    }
                                    placeholder={`Antwoordoptie ${index + 1}`}
                                    className="flex-1 rounded-xl border border-slate-200 p-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                  />

                                  <input
                                    type="number"
                                    value={optie.sortering}
                                    onChange={(e) =>
                                      updateOptie(index, {
                                        sortering: Number(e.target.value),
                                      })
                                    }
                                    className="w-24 rounded-xl border border-slate-200 p-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                  />

                                  <button
                                    type="button"
                                    onClick={() => verwijderOptie(index)}
                                    className="inline-flex items-center justify-center rounded-xl border border-red-200 p-2 text-red-700 hover:bg-red-50"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setBewerkVraag(null)}
                          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                        >
                          Annuleren
                        </button>

                        <button
                          type="button"
                          disabled={bezig}
                          onClick={slaVraagOp}
                          className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <Save className="h-4 w-4" />
                          Vraag opslaan
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}