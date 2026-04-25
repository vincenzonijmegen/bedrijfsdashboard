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

function getWhatsappNumber(telefoon: string) {
  return telefoon.replace(/\D/g, "").replace(/^0/, "31");
}

function getGegevensWhatsappText(naam: string) {
  return `*IJssalon Vincenzo*

*IJssalon Vincenzo*

Beste ${naam},

Welkom bij IJssalon Vincenzo! 

In dit bericht vind je alle belangrijke informatie en werkinstructies. Neem deze zo snel mogelijk door en rond af wat nodig is.
Heb je iets niet helemaal duidelijk? Reageer gerust op dit bericht 👍

*Tools*

Je krijgt toegang tot:

• *ShiftBase*  
Planning, rooster, verlof en ruilen

• *Employes*  
Contract en salarisstroken

• *Vincenzo-app*  
Werkinstructies en skills

*Gegevens voor contract*

We hebben van je nodig:

• Kopie ID (voor- en achterzijde) of paspoort (fotopagina)  
→ *Niet bewerkt*

• IBAN (bankrekeningnummer)

• Loonheffingskorting  
→ Ja als dit je enige baan is  
→ Nee als je nog een werkgever hebt

*Foto (ShiftBase & app)*

Stuur een duidelijke foto van jezelf (alleen gezicht zichtbaar).  
Deze gebruiken we alleen intern en verwijderen we na je dienstverband (AVG-proof).

*Aanleveren*

Je kunt alles gewoon via WhatsApp sturen (of mailen naar: herman@ijssalonvincenzo.nl)
Als je nog vragen hebt kun je die eventueel ook via WhatsApp aan mij stellen.

Met vriendelijke groet,  
Herman van den Akker  
IJssalon Vincenzo`;
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

  async function deleteSollicitatie() {
    if (!id) return;

    const ok = window.confirm(
      "Weet je zeker dat je deze sollicitatie definitief wilt verwijderen? Dit kan niet ongedaan worden gemaakt."
    );

    if (!ok) return;

    try {
      const res = await fetch(`/api/sollicitaties/${id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json?.error || "Verwijderen mislukt");
      }

      window.location.href = "/admin/sollicitaties";
    } catch (err) {
      alert(err instanceof Error ? err.message : "Verwijderen mislukt");
    }
  }

function openGegevensModal() {
  if (!data) return;

  setGegevensText(getGegevensWhatsappText(data.voornaam));
  setShowGegevensModal(true);
}

async function sendGegevensWhatsapp() {
  if (!data) return;

  const nummer = data.telefoon.replace(/\D/g, "").replace(/^0/, "31");

  const url = `https://wa.me/${nummer}?text=${encodeURIComponent(
    gegevensText
  )}`;

  window.open(url, "_blank");

  setShowGegevensModal(false);

  await updateStatus("wacht op gegevens");
}

  function openWhatsappModal() {
    if (!data) return;
    setWhatsappText(getDefaultWhatsappText(data.voornaam));
    setShowWhatsappModal(true);
  }

  async function sendWhatsapp() {
    if (!data) return;

    const nummer = getWhatsappNumber(data.telefoon);
    const url = `https://wa.me/${nummer}?text=${encodeURIComponent(
      whatsappText
    )}`;

    window.open(url, "_blank");

    setShowWhatsappModal(false);
    await updateStatus("uitgenodigd");
  }

  if (!data) return <div className="p-6">Laden...</div>;

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      <Link
        href="/admin/sollicitaties"
        className="inline-flex items-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700"
      >
        ← Terug naar sollicitaties
      </Link>

      <Link
  href={`/admin/sollicitaties/${id}/gesprek`}
  className="mt-3 block w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-medium text-slate-700 hover:bg-slate-50"
>
  Gespreksdocument openen
</Link>

      <h1 className="text-2xl font-bold">
        {data.voornaam} {data.achternaam}
      </h1>

      <section className="rounded-xl border bg-white p-4">
        <label className="mb-2 block text-sm font-medium text-slate-700">
          Status sollicitatie
        </label>

        <select
          value={data.status || "nieuw"}
          onChange={(e) => updateStatus(e.target.value)}
          disabled={savingStatus}
          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="nieuw">Nieuw</option>
          <option value="uitgenodigd">Uitgenodigd</option>
          <option value="gesprek gepland">Gesprek gepland</option>
          <option value="in de wacht">In de wacht</option>
          <option value="aangenomen">Aangenomen</option>
          <option value="wacht op gegevens">Wacht op gegevens</option>
          <option value="afgewezen">Afgewezen</option>
        </select>

        {savingStatus ? (
          <p className="mt-2 text-xs text-slate-500">Status opslaan...</p>
        ) : null}

        <button
          onClick={openWhatsappModal}
          className="mt-4 w-full rounded-xl bg-green-600 px-4 py-3 text-sm font-medium text-white hover:bg-green-700"
        >
          Uitnodigen via WhatsApp
        </button>
      </section>

<button
  onClick={openGegevensModal}
  className="mt-2 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-medium text-white hover:bg-blue-700"
>
  Gegevens opvragen
</button>



      <section className="rounded-xl border bg-white p-4 space-y-3">
        <h2 className="font-semibold">Gesprek</h2>

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
            rows={6}
            className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
            placeholder="Notities tijdens of na het gesprek..."
          />
        </div>

        {savingGesprek ? (
          <p className="text-xs text-slate-500">Gesprek opslaan...</p>
        ) : null}
      </section>

      <section className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold mb-2">Gegevens</h2>
        <div className="text-sm space-y-1">
          <div>Geslacht: {data.geslacht || "-"}</div>
          <div>Email: {data.email}</div>
          <div>Tel: {data.telefoon}</div>
          <div>
            Adres: {data.adres} {data.huisnummer}, {data.postcode}{" "}
            {data.woonplaats}
          </div>
          <div>
            Geboortedatum: {formatDateNl(data.geboortedatum)}
            {data.geboortedatum
              ? ` (${berekenLeeftijd(data.geboortedatum)} jaar)`
              : ""}
          </div>
        </div>
      </section>

      <section className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold mb-2">Beschikbaarheid</h2>
        <ul className="list-disc ml-5 text-sm">
          {data.beschikbaar_momenten?.map((m: string) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </section>

      <section className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold mb-2">Overig</h2>
        <div className="text-sm space-y-1">
          <div>Beschikbaar vanaf: {formatDateNl(data.beschikbaar_vanaf)}</div>
          <div>Beschikbaar tot: {formatDateNl(data.beschikbaar_tot)}</div>
          <div>Bijbaan: {data.bijbaan}</div>
          <div>Shifts per week: {data.shifts_per_week}</div>
          <div>Voorkeur: {data.voorkeur_functie}</div>
          <div>Vakantie: {data.vakantie}</div>
        </div>
      </section>

      <section className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold mb-2">Motivatie</h2>
        <p className="text-sm whitespace-pre-wrap">{data.motivatie}</p>
      </section>

      <section className="rounded-xl border border-red-200 bg-red-50 p-4">
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
          <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl space-y-3">
            <h2 className="text-lg font-semibold">
              WhatsApp bericht aanpassen
            </h2>

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
    <div className="w-full max-w-lg rounded-2xl bg-white p-4 shadow-xl space-y-3">
      <h2 className="text-lg font-semibold">
        Gegevens opvragen (WhatsApp)
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