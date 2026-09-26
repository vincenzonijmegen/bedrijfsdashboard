"use client";

import * as React from "react";
import Link from "next/link";
import {
  BriefcaseBusiness,
  CheckCircle2,
  Clock3,
  Globe2,
  Loader2,
  Save,
  Snowflake,
  Sun,
} from "lucide-react";

type SeasonMode = "winter" | "march" | "summer";
type RecruitmentMode = "closed" | "summer";

type WinterConfig = {
  active?: boolean;
  reopenText: string;
  topbarText: string;
  heroLabel: string;
  heroStatus: string;
  heroText: string;
  photoText: string;
  locationTitle: string;
  locationText: string;
};

type RecruitmentConfig = {
  mode: RecruitmentMode;
  closedTitle: string;
  closedText: string;
  summerTitle: string;
  summerText: string;
};

type WebsiteConfig = {
  season: { mode: SeasonMode };
  winter: WinterConfig;
  recruitment: RecruitmentConfig;
};

const EMPTY_CONFIG: WebsiteConfig = {
  season: { mode: "winter" },
  winter: {
    active: true,
    reopenText: "1 maart 2027",
    topbarText: "❄️ Gesloten voor de winter · vanaf {reopen} weer open",
    heroLabel: "Winterstop",
    heroStatus: "Gesloten",
    heroText: "We zijn er weer vanaf {reopen}",
    photoText: "Bedankt voor een prachtig ijsseizoen. Tot volgend jaar!",
    locationTitle: "❄️ Winterstop",
    locationText:
      "IJssalon Vincenzo is gesloten voor de winter. Vanaf {reopen} staan we weer voor je klaar met vers ijs uit eigen keuken.",
  },
  recruitment: {
    mode: "closed",
    closedTitle:
      "Momenteel zoeken wij geen medewerkers meer. Vanaf januari kun je je weer aanmelden voor het nieuwe seizoen.",
    closedText:
      "Je kunt al wel je gegevens achterlaten via onderstaand formulier.",
    summerTitle: "Ben je op zoek naar een leuke zomerbaan?",
    summerText:
      "Bij Vincenzo werk je in een gezellig team in hartje Nijmegen, midden tussen het ijs en de drukte van de stad. We zoeken enthousiaste medewerkers die graag aanpakken en minimaal 1 shift in het weekend beschikbaar zijn. Vul het formulier hieronder in; als jouw beschikbaarheid bij ons past, nemen we contact met je op.",
  },
};

function replaceReopen(value: string, reopen: string) {
  return value.replaceAll("{reopen}", reopen);
}

function seasonDescription(mode: SeasonMode) {
  if (mode === "winter") return "Gesloten voor de winter";
  if (mode === "march") return "Open · dagelijks tot 20:00 uur";
  return "Open · dagelijks tot 22:00 uur";
}

function recruitmentPreview(r: RecruitmentConfig) {
  return r.mode === "summer"
    ? { title: r.summerTitle, text: r.summerText }
    : { title: r.closedTitle, text: r.closedText };
}

export default function WebsiteBeheerPage() {
  const [config, setConfig] = React.useState<WebsiteConfig>(EMPTY_CONFIG);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [error, setError] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/website-instellingen", {
          cache: "no-store",
        });
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data?.error || "Instellingen konden niet worden geladen.");
        }

        if (!cancelled) {
          setConfig({
            ...EMPTY_CONFIG,
            ...data,
            season: { ...EMPTY_CONFIG.season, ...(data?.season || {}) },
            winter: { ...EMPTY_CONFIG.winter, ...(data?.winter || {}) },
            recruitment: {
              ...EMPTY_CONFIG.recruitment,
              ...(data?.recruitment || {}),
            },
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Onbekende fout.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function updateSeason(mode: SeasonMode) {
    setConfig((current) => ({
      ...current,
      season: { mode },
      winter: { ...current.winter, active: mode === "winter" },
    }));
    setMessage("");
  }

  function updateWinter<K extends keyof WinterConfig>(
    key: K,
    value: WinterConfig[K]
  ) {
    setConfig((current) => ({
      ...current,
      winter: { ...current.winter, [key]: value },
    }));
    setMessage("");
  }

  function updateRecruitment<K extends keyof RecruitmentConfig>(
    key: K,
    value: RecruitmentConfig[K]
  ) {
    setConfig((current) => ({
      ...current,
      recruitment: { ...current.recruitment, [key]: value },
    }));
    setMessage("");
  }

  async function save() {
    try {
      setSaving(true);
      setMessage("");
      setError("");

      const response = await fetch("/api/website-instellingen", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Publiceren is mislukt.");
      }

      if (data?.config) setConfig(data.config);
      setMessage("Website-instellingen zijn opgeslagen en gepubliceerd.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Onbekende fout.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-100 px-6 py-8">
        <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <div className="flex items-center gap-3 text-slate-700">
            <Loader2 className="h-5 w-5 animate-spin" />
            Website-instellingen laden…
          </div>
        </div>
      </main>
    );
  }

  const w = config.winter;
  const r = config.recruitment;
  const vacancyPreview = recruitmentPreview(r);

  return (
    <main className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-1 text-sm font-medium text-blue-600">
                IJssalon Vincenzo / Beheer
              </div>
              <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-950">
                <Globe2 className="h-6 w-6" /> Website beheren
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                Pas de seizoensstand en vacaturetekst aan. Opslaan publiceert direct naar Cloud86.
              </p>
            </div>

            <Link
              href="/admin"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Terug naar dashboard
            </Link>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-800">
            {error}
          </div>
        )}

        {message && (
          <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-medium text-emerald-800">
            <CheckCircle2 className="h-5 w-5" /> {message}
          </div>
        )}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-blue-50 px-6 py-4">
            <h2 className="flex items-center gap-2 font-bold text-blue-950">
              <Clock3 className="h-5 w-5" /> Seizoensstand & openingstijden
            </h2>
            <p className="mt-1 text-sm text-blue-800">
              Deze keuze geldt voor zowel de homepage als locatie.php.
            </p>
          </div>

          <div className="p-6">
            <label className="block max-w-xl">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Actieve stand
              </span>
              <select
                value={config.season.mode}
                onChange={(event) => updateSeason(event.target.value as SeasonMode)}
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              >
                <option value="winter">Winterstop · gesloten</option>
                <option value="march">Maart · open tot 20:00 uur</option>
                <option value="summer">Zomer · open tot 22:00 uur</option>
              </select>
            </label>

            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <strong>Actief:</strong> {seasonDescription(config.season.mode)}
              {config.season.mode === "march" && (
                <div className="mt-1 text-slate-500">
                  Maandag t/m zaterdag 12:00–20:00 · zondag 13:00–20:00
                </div>
              )}
              {config.season.mode === "summer" && (
                <div className="mt-1 text-slate-500">
                  Maandag t/m zaterdag 12:00–22:00 · zondag 13:00–22:00
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-blue-50 px-6 py-4">
            <div>
              <h2 className="flex items-center gap-2 font-bold text-blue-950">
                <Snowflake className="h-5 w-5" /> Winterteksten
              </h2>
              <p className="mt-1 text-sm text-blue-800">
                Deze teksten worden alleen gebruikt als de seizoensstand op Winterstop staat.
              </p>
            </div>
            {config.season.mode === "winter" ? (
              <span className="rounded-full bg-blue-600 px-3 py-1 text-xs font-bold text-white">ACTIEF</span>
            ) : (
              <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-600">NIET ACTIEF</span>
            )}
          </div>

          <div className="grid gap-5 p-6 md:grid-cols-2">
            <Field
              label="Heropening"
              value={w.reopenText}
              onChange={(value) => updateWinter("reopenText", value)}
              placeholder="1 maart 2027"
            />

            <div className="md:col-span-2">
              <Field
                label="Blauwe balk bovenaan"
                value={w.topbarText}
                onChange={(value) => updateWinter("topbarText", value)}
              />
            </div>

            <Field
              label="Label bij foto"
              value={w.heroLabel}
              onChange={(value) => updateWinter("heroLabel", value)}
            />

            <Field
              label="Status bij foto"
              value={w.heroStatus}
              onChange={(value) => updateWinter("heroStatus", value)}
            />

            <div className="md:col-span-2">
              <Field
                label="Tekst bij foto"
                value={w.heroText}
                onChange={(value) => updateWinter("heroText", value)}
              />
            </div>

            <div className="md:col-span-2">
              <Field
                label="Tekst over de grote foto"
                value={w.photoText}
                onChange={(value) => updateWinter("photoText", value)}
              />
            </div>

            <Field
              label="Kop openingstijdenblok"
              value={w.locationTitle}
              onChange={(value) => updateWinter("locationTitle", value)}
            />

            <div className="md:col-span-2">
              <TextArea
                label="Tekst openingstijdenblok"
                value={w.locationText}
                onChange={(value) => updateWinter("locationText", value)}
              />
            </div>

            <div className="md:col-span-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              Gebruik <code className="rounded bg-white px-1.5 py-0.5">{"{reopen}"}</code>{" "}
              om automatisch de waarde uit <strong>Heropening</strong> in te vullen.
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-emerald-50 px-6 py-4">
            <h2 className="flex items-center gap-2 font-bold text-emerald-950">
              <BriefcaseBusiness className="h-5 w-5" /> Solliciteren
            </h2>
            <p className="mt-1 text-sm text-emerald-800">
              Kies welke vacaturetekst zichtbaar is op solliciteren.php. Beide teksten blijven hieronder aanpasbaar.
            </p>
          </div>

          <div className="space-y-6 p-6">
            <label className="block max-w-xl">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                Actieve vacaturetekst
              </span>
              <select
                value={r.mode}
                onChange={(event) =>
                  updateRecruitment("mode", event.target.value as RecruitmentMode)
                }
                className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              >
                <option value="closed">Geen medewerkers gezocht</option>
                <option value="summer">Zomerbaan / medewerkers gezocht</option>
              </select>
            </label>

            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                Voorbeeld op de website
              </div>
              <div className="mt-2 font-bold text-slate-900">{vacancyPreview.title}</div>
              <div className="mt-2 text-sm leading-6 text-slate-700">{vacancyPreview.text}</div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-4 flex items-center gap-2 font-bold text-slate-900">
                  <Snowflake className="h-4 w-4 text-blue-600" /> Geen medewerkers gezocht
                </div>
                <div className="space-y-4">
                  <TextArea
                    label="Koptekst"
                    value={r.closedTitle}
                    onChange={(value) => updateRecruitment("closedTitle", value)}
                    rows={3}
                  />
                  <TextArea
                    label="Tekst eronder"
                    value={r.closedText}
                    onChange={(value) => updateRecruitment("closedText", value)}
                    rows={4}
                  />
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <div className="mb-4 flex items-center gap-2 font-bold text-slate-900">
                  <Sun className="h-4 w-4 text-amber-500" /> Zomerbaan / medewerkers gezocht
                </div>
                <div className="space-y-4">
                  <TextArea
                    label="Koptekst"
                    value={r.summerTitle}
                    onChange={(value) => updateRecruitment("summerTitle", value)}
                    rows={3}
                  />
                  <TextArea
                    label="Tekst eronder"
                    value={r.summerText}
                    onChange={(value) => updateRecruitment("summerText", value)}
                    rows={5}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-bold text-slate-950">Voorbeeld bovenbalk homepage</h2>
          <div className="mt-4 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white">
            {config.season.mode === "winter"
              ? replaceReopen(w.topbarText, w.reopenText)
              : config.season.mode === "march"
                ? "Vandaag open: 12:00 – 20:00 · Koningstraat 35, Nijmegen"
                : "Vandaag open: 12:00 – 22:00 · Koningstraat 35, Nijmegen"}
          </div>
        </section>

        <div className="sticky bottom-4 flex justify-end">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-6 font-semibold text-white shadow-lg transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Save className="h-5 w-5" />
            )}
            {saving ? "Publiceren…" : "Opslaan & publiceren"}
          </button>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  rows = 4,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={rows}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
      />
    </label>
  );
}
