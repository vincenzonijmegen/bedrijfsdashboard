"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function formatDateNl(value: string | null) {
  if (!value) return "-";
  const d = new Date(value);
  return d.toLocaleDateString("nl-NL");
}

function formatDateTimeLocal(value: string | null) {
  if (!value) return "";
  const d = new Date(value);
  const offset = d.getTimezoneOffset();
  const local = new Date(d.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function berekenLeeftijd(value: string | null) {
  if (!value) return null;
  const geboortedatum = new Date(value);
  const vandaag = new Date();

  let leeftijd = vandaag.getFullYear() - geboortedatum.getFullYear();
  const maandVerschil = vandaag.getMonth() - geboortedatum.getMonth();

  if (
    maandVerschil < 0 ||
    (maandVerschil === 0 && vandaag.getDate() < geboortedatum.getDate())
  ) {
    leeftijd--;
  }

  return leeftijd;
}

function getDefaultWhatsappText(naam: string) {
  return `*Bericht van IJssalon Vincenzo*
Beste ${naam},

Hartelijk bedankt voor je sollicitatie.

Graag nodigen we je uit voor een kort gesprek in de ijssalon.
Via onderstaande link kun je een tijdstip boeken.

Met vriendelijke groet,
Herman van den Akker
IJssalon Vincenzo

https://calendly.com/ijssalonvincenzo/sollicitatiegesprek-1`;
}

function getGegevensWhatsappText(naam: string) {
  return `*IJssalon Vincenzo*

Beste ${naam},

Welkom bij IJssalon Vincenzo!

We hebben nog een aantal gegevens nodig voor je contract, salarisverwerking en toegang tot onze tools.

*Gegevens voor contract*
• Kopie ID of paspoort
• IBAN
• Loonheffingskorting ja/nee

*Foto*
Stuur ook een duidelijke foto van jezelf, alleen gezicht zichtbaar.

Je kunt alles via WhatsApp sturen of mailen naar herman@ijssalonvincenzo.nl.

Met vriendelijke groet,
Herman van den Akker
IJssalon Vincenzo`;
}

function getWhatsappNumber(telefoon: string) {
  return telefoon.replace(/\D/g, "").replace(/^0/, "31");
}

export default function SollicitatieDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [id, setId] = useState<string | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [savingGesprek, setSavingGesprek] = useState(false);
  const [showWhatsappModal, setShowWhatsappModal] = useState(false);
  const [whatsappText, setWhatsappText] = useState("");
  const [showGegevensModal, setShowGegevensModal] = useState(false);
  const [gegevensText, setGegevensText] = useState("");

  useMemo(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  const { data, mutate } = useSWR(
    id ? `/api/sollicitaties/${id}` : null,
    fetcher
  );

  async function patchSollicitatie(body: Record<string, unknown>) {
    if (!id) return;

    const res = await fetch(`/api/sollicitaties/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const json = await res.json();

    if (!res.ok) {
      throw new Error(json?.error || "Opslaan mislukt");
    }

    await mutate();
  }

  async function updateStatus(status: string) {
    try {
      setSavingStatus(true);
      await patchSollicitatie({ status });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Status aanpassen mislukt");
    } finally {
      setSavingStatus(false);
    }
  }

  async function updateGesprek(
    gesprekDatum: string | null,
    gesprekNotities: string | null,
    zetStatus = false
  ) {
    try {
      setSavingGesprek(true);
      await patchSollicitatie({
        gesprek_datum: gesprekDatum,
        gesprek_notities: gesprekNotities,
        ...(zetStatus ? { status: "gesprek gepland" } : {}),
      });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Gesprek opslaan mislukt");
    } finally {
      setSavingGesprek(false);
    }
  }

  async function updateChecklist(veld: string, waarde: boolean) {
    try {
      await patchSollicitatie({ [veld]: waarde });
    } catch (err) {
      alert(err instanceof Error ? err.message : "Checklist opslaan mislukt");
    }
  }

  async function deleteSollicitatie() {
    if (!id) return;
    const ok = window.confirm(
      "Weet je zeker dat je deze sollicitatie definitief wilt verwijderen? Dit kan niet ongedaan worden gemaakt."
    );

    if (!ok) return;

    try {
      const res = await fetch(`/api/sollicitaties/${id}`, { method: "DELETE" });
      const json = await res.json();

      if (!res.ok) throw new Error(json?.error || "Verwijderen mislukt");

      window.location.href = "/admin/sollicitaties";
    } catch (err) {
      alert(err instanceof Error ? err.message : "Verwijderen mislukt");
    }
  }

  function openWhatsappModal() {
    if (!data) return;
    setWhatsappText(getDefaultWhatsappText(data.voornaam));
    setShowWhatsappModal(true);
  }

  async function sendWhatsapp() {
    if (!data) return;
    const nummer = getWhatsappNumber(data.telefoon);
    window.open(
      `https://wa.me/${nummer}?text=${encodeURIComponent(whatsappText)}`,
      "_blank"
    );

    setShowWhatsappModal(false);
    await updateStatus("uitgenodigd");
  }

  function openGegevensModal() {
    if (!data) return;
    setGegevensText(getGegevensWhatsappText(data.voornaam));
    setShowGegevensModal(true);
  }

  async function sendGegevensWhatsapp() {
    if (!data) return;
    const nummer = getWhatsappNumber(data.telefoon);
    window.open(
      `https://wa.me/${nummer}?text=${encodeURIComponent(gegevensText)}`,
      "_blank"
    );

    setShowGegevensModal(false);
    await updateStatus("wacht op gegevens");
  }

  if (!data) return <div className="p-6">Laden...</div>;

  return (
    <main className="mx-auto max-w-6xl space-y-5 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/sollicitaties"
          className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
        >
          ← Terug naar sollicitaties
        </Link>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/sollicitaties/${id}/gesprek`}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Gespreksdocument
          </Link>

          <Link
            href={`/admin/medewerkers?naam=${encodeURIComponent(
              `${data.voornaam} ${data.achternaam}`
            )}&email=${encodeURIComponent(data.email || "")}`}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
          >
            Toevoegen aan app
          </Link>
        </div>
      </div>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
          <div>
            <p className="text-sm text-slate-500">Sollicitatie</p>
            <h1 className="text-3xl font-bold text-slate-900">
              {data.voornaam} {data.achternaam}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {data.email} · {data.telefoon}
            </p>
          </div>

          <div className="space-y-3">
            <select
              value={data.status || "nieuw"}
              onChange={(e) => updateStatus(e.target.value)}
              disabled={savingStatus}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm"
            >
              <option value="nieuw">Nieuw</option>
              <option value="uitgenodigd">Uitgenodigd</option>
              <option value="gesprek gepland">Gesprek gepland</option>
              <option value="in de wacht">In de wacht</option>
              <option value="wacht op gegevens">Wacht op gegevens</option>
              <option value="aangenomen">Aangenomen</option>
              <option value="afgewezen">Afgewezen</option>
            </select>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <button
                onClick={openWhatsappModal}
                className="rounded-xl bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700"
              >
                Uitnodigen via WhatsApp
              </button>

              <button
                onClick={openGegevensModal}
                className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700"
              >
                Gegevens opvragen
              </button>
            </div>

            {savingStatus ? (
              <p className="text-xs text-slate-500">Status opslaan...</p>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Gesprek</h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm text-slate-700">
                Datum en tijd gesprek
              </label>
              <input
                type="datetime-local"
                defaultValue={formatDateTimeLocal(data.gesprek_datum)}
                onBlur={(e) =>
                  updateGesprek(
                    e.target.value || null,
                    data.gesprek_notities || null,
                    Boolean(e.target.value)
                  )
                }
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-slate-700">
                Gespreksnotities
              </label>
              <textarea
                defaultValue={data.gesprek_notities || ""}
                onBlur={(e) =>
                  updateGesprek(
                    data.gesprek_datum || null,
                    e.target.value || null,
                    false
                  )
                }
                rows={8}
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                placeholder="Notities tijdens of na het gesprek..."
              />
            </div>

            {savingGesprek ? (
              <p className="text-xs text-slate-500">Gesprek opslaan...</p>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Onboarding checklist</h2>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">
                Contract
              </h3>

              {[
                ["id_ontvangen", "ID ontvangen"],
                ["iban_ontvangen", "IBAN ontvangen"],
                ["loonheffing_ontvangen", "Loonheffing ontvangen"],
                ["pasfoto_ontvangen", "Pasfoto ontvangen"],
              ].map(([veld, label]) => (
                <label key={veld} className="mb-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(data[veld])}
                    onChange={(e) => updateChecklist(veld, e.target.checked)}
                    className="h-4 w-4"
                  />
                  {label}
                </label>
              ))}
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-slate-700">
                Systemen & groepen
              </h3>

              {[
                ["employes_ingevoerd", "Ingevoerd in Employes"],
                ["shiftbase_ingevoerd", "Toegevoegd aan ShiftBase"],
                ["vincenzo_app_ingevoerd", "Toegevoegd aan Vincenzo-app"],
                ["whatsapp_vincenzo", "WhatsApp groep Vincenzo"],
                ["whatsapp_ruilen", "WhatsApp groep Ruilen"],
              ].map(([veld, label]) => (
                <label key={veld} className="mb-2 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={Boolean(data[veld])}
                    onChange={(e) => updateChecklist(veld, e.target.checked)}
                    className="h-4 w-4"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Kandidaatgegevens</h2>
          <div className="space-y-1 text-sm">
            <div>Geslacht: {data.geslacht || "-"}</div>
            <div>Email: {data.email || "-"}</div>
            <div>Tel: {data.telefoon || "-"}</div>
            <div>
              Adres: {data.adres || "-"} {data.huisnummer || ""},{" "}
              {data.postcode || ""} {data.woonplaats || ""}
            </div>
            <div>
              Geboortedatum: {formatDateNl(data.geboortedatum)}
              {data.geboortedatum
                ? ` (${berekenLeeftijd(data.geboortedatum)} jaar)`
                : ""}
            </div>
          </div>
        </section>

        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-semibold">Overig</h2>
          <div className="space-y-1 text-sm">
            <div>Beschikbaar vanaf: {formatDateNl(data.beschikbaar_vanaf)}</div>
            <div>Beschikbaar tot: {formatDateNl(data.beschikbaar_tot)}</div>
            <div>Bijbaan: {data.bijbaan || "-"}</div>
            <div>Shifts per week: {data.shifts_per_week || "-"}</div>
            <div>Voorkeur: {data.voorkeur_functie || "-"}</div>
            <div>Vakantie: {data.vakantie || "-"}</div>
          </div>
        </section>
      </div>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Beschikbaarheid</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {data.beschikbaar_momenten?.map((m: string) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </section>

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-lg font-semibold">Motivatie</h2>
        <p className="whitespace-pre-wrap text-sm">{data.motivatie || "-"}</p>
      </section>

      <section className="rounded-2xl border border-red-200 bg-red-50 p-5">
        <h2 className="font-semibold text-red-800">Verwijderen</h2>
        <p className="mt-1 text-sm text-red-700">
          Gebruik dit voor dubbele sollicitaties of kandidaten die definitief
          zijn afgewezen.
        </p>

        <button
          onClick={deleteSollicitatie}
          className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Sollicitatie definitief verwijderen
        </button>
      </section>

      {showWhatsappModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg space-y-3 rounded-2xl bg-white p-4 shadow-xl">
            <h2 className="text-lg font-semibold">WhatsApp bericht aanpassen</h2>
            <textarea
              value={whatsappText}
              onChange={(e) => setWhatsappText(e.target.value)}
              rows={11}
              className="w-full rounded-xl border border-slate-300 p-3 text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={sendWhatsapp}
                className="flex-1 rounded-xl bg-green-600 py-3 text-sm font-medium text-white hover:bg-green-700"
              >
                Versturen via WhatsApp
              </button>
              <button
                onClick={() => setShowWhatsappModal(false)}
                className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-medium"
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}

      {showGegevensModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg space-y-3 rounded-2xl bg-white p-4 shadow-xl">
            <h2 className="text-lg font-semibold">
              Gegevens opvragen via WhatsApp
            </h2>
            <textarea
              value={gegevensText}
              onChange={(e) => setGegevensText(e.target.value)}
              rows={12}
              className="w-full rounded-xl border border-slate-300 p-3 text-sm"
            />
            <div className="flex gap-2">
              <button
                onClick={sendGegevensWhatsapp}
                className="flex-1 rounded-xl bg-blue-600 py-3 text-sm font-medium text-white hover:bg-blue-700"
              >
                Versturen via WhatsApp
              </button>
              <button
                onClick={() => setShowGegevensModal(false)}
                className="flex-1 rounded-xl border border-slate-300 py-3 text-sm font-medium"
              >
                Annuleren
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}