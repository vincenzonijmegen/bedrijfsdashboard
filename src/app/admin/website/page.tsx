"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Globe2, Loader2, Save, Snowflake } from "lucide-react";

type WinterConfig = {
  active: boolean;
  reopenText: string;
  topbarText: string;
  heroLabel: string;
  heroStatus: string;
  heroText: string;
  photoText: string;
  locationTitle: string;
  locationText: string;
};

type WebsiteConfig = {
  winter: WinterConfig;
};

const EMPTY_CONFIG: WebsiteConfig = {
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
};

function replaceReopen(value: string, reopen: string) {
  return value.replaceAll("{reopen}", reopen);
}

export default function WebsiteBeheerPage() {
  const [config, setConfig] = React.useState<WebsiteConfig>(EMPTY_CONFIG);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [message, setMessage] = React.useState<string>("");
  const [error, setError] = React.useState<string>("");

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

        if (!cancelled) setConfig(data);
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

  function updateWinter<K extends keyof WinterConfig>(
    key: K,
    value: WinterConfig[K]
  ) {
    setConfig((current) => ({
      ...current,
      winter: {
        ...current.winter,
        [key]: value,
      },
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
                Wijzig hier de variabele teksten van de website. Opslaan publiceert
                de wijziging direct naar Cloud86.
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
          <div className="flex items-center justify-between gap-4 border-b border-slate-200 bg-blue-50 px-6 py-4">
            <div>
              <h2 className="flex items-center gap-2 font-bold text-blue-950">
                <Snowflake className="h-5 w-5" /> Winterstand
              </h2>
              <p className="mt-1 text-sm text-blue-800">
                Als deze aanstaat worden de normale openingstijden op de homepage uitgezet.
              </p>
            </div>

            <button
              type="button"
              onClick={() => updateWinter("active", !w.active)}
              className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition ${
                w.active ? "bg-blue-600" : "bg-slate-300"
              }`}
              aria-pressed={w.active}
              aria-label="Winterstand aan of uit"
            >
              <span
                className={`inline-block h-6 w-6 rounded-full bg-white shadow transition ${
                  w.active ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
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
              in een tekst om automatisch de waarde uit <strong>Heropening</strong> in te vullen.
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-bold text-slate-950">Voorbeeld wintermelding</h2>
          <div className="mt-4 rounded-xl bg-blue-700 px-4 py-3 text-sm font-semibold text-white">
            {w.active
              ? replaceReopen(w.topbarText, w.reopenText)
              : "Vandaag open: normale openingstijden worden getoond"}
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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-950 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
      />
    </label>
  );
}
