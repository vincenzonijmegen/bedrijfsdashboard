"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const statusOpties = [
  "nieuw",
  "wacht op gegevens",
  "gesprek gepland",
  "uitgenodigd",
  "in de wacht",
  "aangenomen",
  "afgewezen",
];

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

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

  useEffect(() => {
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

    const nummer = getWhatsappNumber(data.telefoon || "");
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

    const nummer = getWhatsappNumber(data.telefoon || "");
    window.open(
      `https://wa.me/${nummer}?text=${encodeURIComponent(gegevensText)}`,
      "_blank"
    );

    setShowGegevensModal(false);
    await updateStatus("wacht op gegevens");
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-100 p-6">
        <div className="mx-auto max-w-6xl rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Laden...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <div className="mx-auto max-w-6xl space-y-5 p-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
                Sollicitatie
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-900">
                {data.voornaam} {data.achternaam}
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                {data.email || "-"} · {data.telefoon || "-"}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/admin/sollicitaties"
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                ← Terug
              </Link>

              <Link
                href={`/admin/sollicitaties/${id}/gesprek`}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Gespreksdocument
              </Link>

              <Link
                href={`/admin/medewerkers?naam=${encodeURIComponent(
                  `${data.voornaam} ${data.achternaam}`
                )}&email=${encodeURIComponent(data.email || "")}&geboortedatum=${encodeURIComponent(
                  data.geboortedatum || ""
                )}`}
                className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
              >
                Toevoegen aan app
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Info label="Status" value={formatStatus(data.status || "nieuw")} />
              <Info label="Voorkeur" value={data.voorkeur_functie || "-"} />
              <Info label="Shifts per week" value={data.shifts_per_week || "-"} />
            </div>

            <div className="space-y-3">
              <select
                value={data.status || "nieuw"}
                onChange={(e) => updateStatus(e.target.value)}
                disabled={savingStatus}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-medium text-slate-900 outline-none focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
              >
                {statusOpties.map((status) => (
                  <option key={status} value={status}>
                    {formatStatus(status)}
                  </option>
                ))}
              </select>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
                <button
                  onClick={openWhatsappModal}
                  className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
                >
                  Uitnodigen via WhatsApp
                </button>

                <button
                  onClick={openGegevensModal}
                  className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
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
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-slate-900">Gesprek</h2>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-semibold text-slate-700">
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
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm outline-none focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                  placeholder="Notities tijdens of na het gesprek..."
                />
              </div>

              {savingGesprek ? (
                <p className="text-xs text-slate-500">Gesprek opslaan...</p>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-slate-900">
              Onboarding checklist
            </h2>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <ChecklistGroep
                titel="Contract"
                data={data}
                items={[
                  ["id_ontvangen", "ID ontvangen"],
                  ["iban_ontvangen", "IBAN ontvangen"],
                  ["loonheffing_ontvangen", "Loonheffing ontvangen"],
                  ["pasfoto_ontvangen", "Pasfoto ontvangen"],
                ]}
                onChange={updateChecklist}
              />

              <ChecklistGroep
                titel="Systemen & groepen"
                data={data}
                items={[
                  ["employes_ingevoerd", "Ingevoerd in Employes"],
                  ["shiftbase_ingevoerd", "Toegevoegd aan ShiftBase"],
                  ["vincenzo_app_ingevoerd", "Toegevoegd aan Vincenzo-app"],
                  ["whatsapp_vincenzo", "WhatsApp groep Vincenzo"],
                  ["whatsapp_ruilen", "WhatsApp groep Ruilen"],
                ]}
                onChange={updateChecklist}
              />
            </div>
          </section>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-slate-900">
              Kandidaatgegevens
            </h2>

            <div className="grid gap-2 text-sm">
              <Info label="Geslacht" value={data.geslacht || "-"} />
              <Info label="Email" value={data.email || "-"} />
              <Info label="Telefoon" value={data.telefoon || "-"} />
              <Info
                label="Adres"
                value={`${data.adres || "-"} ${data.huisnummer || ""}, ${
                  data.postcode || ""
                } ${data.woonplaats || ""}`}
              />
              <Info
                label="Geboortedatum"
                value={`${formatDateNl(data.geboortedatum)}${
                  data.geboortedatum
                    ? ` (${berekenLeeftijd(data.geboortedatum)} jaar)`
                    : ""
                }`}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold text-slate-900">Overig</h2>

            <div className="grid gap-2 text-sm">
              <Info
                label="Beschikbaar vanaf"
                value={formatDateNl(data.beschikbaar_vanaf)}
              />
              <Info
                label="Beschikbaar tot"
                value={formatDateNl(data.beschikbaar_tot)}
              />
              <Info label="Bijbaan" value={data.bijbaan || "-"} />
              <Info label="Shifts per week" value={data.shifts_per_week || "-"} />
              <Info label="Voorkeur" value={data.voorkeur_functie || "-"} />
              <Info label="Vakantie" value={data.vakantie || "-"} />
            </div>
          </section>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">
            Beschikbaarheid
          </h2>

          {data.beschikbaar_momenten?.length ? (
            <div className="flex flex-wrap gap-2">
              {data.beschikbaar_momenten.map((m: string) => (
                <span
                  key={m}
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-700"
                >
                  {m}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Geen beschikbaarheid ingevuld.</p>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-lg font-bold text-slate-900">Motivatie</h2>
          <p className="whitespace-pre-wrap rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
            {data.motivatie || "-"}
          </p>
        </section>

        <section className="rounded-2xl border border-red-200 bg-red-50 p-5 shadow-sm">
          <h2 className="font-bold text-red-800">Verwijderen</h2>
          <p className="mt-1 text-sm text-red-700">
            Gebruik dit voor dubbele sollicitaties of kandidaten die definitief
            zijn afgewezen.
          </p>

          <button
            onClick={deleteSollicitatie}
            className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700"
          >
            Sollicitatie definitief verwijderen
          </button>
        </section>

        {showWhatsappModal && (
          <WhatsappModal
            title="WhatsApp bericht aanpassen"
            value={whatsappText}
            rows={11}
            buttonLabel="Versturen via WhatsApp"
            buttonClassName="bg-emerald-600 hover:bg-emerald-700"
            onChange={setWhatsappText}
            onSubmit={sendWhatsapp}
            onCancel={() => setShowWhatsappModal(false)}
          />
        )}

        {showGegevensModal && (
          <WhatsappModal
            title="Gegevens opvragen via WhatsApp"
            value={gegevensText}
            rows={12}
            buttonLabel="Versturen via WhatsApp"
            buttonClassName="bg-blue-600 hover:bg-blue-700"
            onChange={setGegevensText}
            onSubmit={sendGegevensWhatsapp}
            onCancel={() => setShowGegevensModal(false)}
          />
        )}
      </div>
    </main>
  );
}

function Info({
  label,
  value,
}: {
  label: string;
  value: string | number | null;
}) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-2">
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium text-slate-800">
        {value || "-"}
      </div>
    </div>
  );
}

function ChecklistGroep({
  titel,
  data,
  items,
  onChange,
}: {
  titel: string;
  data: any;
  items: string[][];
  onChange: (veld: string, waarde: boolean) => void;
}) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-bold text-slate-700">{titel}</h3>

      <div className="space-y-2">
        {items.map(([veld, label]) => (
          <label
            key={veld}
            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700"
          >
            <input
              type="checkbox"
              checked={Boolean(data[veld])}
              onChange={(e) => onChange(veld, e.target.checked)}
              className="h-4 w-4 accent-blue-600"
            />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}

function WhatsappModal({
  title,
  value,
  rows,
  buttonLabel,
  buttonClassName,
  onChange,
  onSubmit,
  onCancel,
}: {
  title: string;
  value: string;
  rows: number;
  buttonLabel: string;
  buttonClassName: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>

        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm outline-none focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
        />

        <div className="mt-4 flex gap-2">
          <button
            onClick={onSubmit}
            className={`flex-1 rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm ${buttonClassName}`}
          >
            {buttonLabel}
          </button>

          <button
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Annuleren
          </button>
        </div>
      </div>
    </div>
  );
}