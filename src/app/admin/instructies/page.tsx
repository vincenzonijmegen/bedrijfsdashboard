"use client";

import useSWR, { mutate } from "swr";
import Link from "next/link";
import {
  BookOpen,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

interface Instructie {
  id: string;
  titel: string;
  nummer?: string;
  functies?: string[];
  slug: string;
  onboarding_fase?: "voor_eerste_shift" | "binnen_2_weken" | "taakgericht";
  onboarding_verplicht?: boolean;
  onboarding_volgorde?: number;
}

function normalizeFuncties(f: unknown): string[] {
  if (Array.isArray(f)) return f as string[];
  if (typeof f === "string" && f.trim()) {
    try {
      const parsed = JSON.parse(f);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function faseLabel(fase?: string) {
  switch (fase) {
    case "voor_eerste_shift":
      return "Voor eerste shift";
    case "binnen_2_weken":
      return "Binnen 2 weken";
    case "taakgericht":
      return "Taakgericht / naslag";
    default:
      return "Taakgericht / naslag";
  }
}

export default function InstructieOverzicht() {
  const { data, error, isLoading } = useSWR<Instructie[]>("/api/instructies");

  if (error) {
    return (
      <div className="min-h-screen bg-slate-100 px-6 py-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-red-200 bg-red-50 px-6 py-5 text-red-700">
          Fout bij laden instructies.
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-slate-100 px-6 py-6">
        <div className="mx-auto max-w-7xl rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center shadow-sm">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin text-blue-600" />
          <p className="text-sm text-slate-500">Instructies laden…</p>
        </div>
      </div>
    );
  }

  const gesorteerd = [...data]
    .map((i) => ({ ...i, functies: normalizeFuncties(i.functies) }))
    .sort((a, b) => (a.nummer || "").localeCompare(b.nummer || ""));

  async function verwijder(slug: string, titel: string) {
    if (!confirm(`Verwijder instructie: ${titel}?`)) return;

    const res = await fetch(`/api/instructies/${slug}`, {
      method: "DELETE",
    });

    if (res.ok) {
      mutate(
        "/api/instructies",
        (old?: Instructie[]) =>
          (old || []).filter((i) => i.slug !== slug),
        false
      );
    } else {
      alert("Verwijderen mislukt");
    }
  }

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-7xl">
        {/* HEADER */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-600">
                <BookOpen className="h-4 w-4" />
                Werkinstructies
              </div>

              <h1 className="text-2xl font-bold text-slate-950">
                Instructies
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Overzicht van alle werkinstructies en gekoppelde functies.
              </p>
            </div>

            <Link
              href="/admin/instructies/nieuw"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
            >
              <Plus size={16} />
              Nieuwe instructie
            </Link>
          </div>
        </div>

        {/* TABLE */}
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-950">
              Instructielijst
            </h2>
            <p className="text-sm text-slate-500">
              Klik op een titel om de instructie te bekijken.
            </p>
          </div>

          {gesorteerd.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-slate-500">
              Nog geen instructies.
            </div>
          ) : (
            <div className="w-full">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                <col className="w-[8%]" />
                <col className="w-[28%]" />
                <col className="w-[24%]" />
                <col className="w-[18%]" />
                <col className="w-[10%]" />
                <col className="w-[12%]" />
              </colgroup>

                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="border-b border-slate-200 px-4 py-2 text-left">
                      Nr
                    </th>
                    <th className="border-b border-slate-200 px-4 py-2 text-left">
                      Titel
                    </th>
                    <th className="border-b border-slate-200 px-4 py-2 text-left">
                      Functies
                    </th>
                    <th className="border-b border-slate-200 px-4 py-2 text-left">
                      Onboarding
                    </th>
                    <th className="border-b border-slate-200 px-4 py-2 text-left">
                      Volgorde
                    </th>
                    <th className="border-b border-slate-200 px-4 py-2 text-right">
                      Acties
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {gesorteerd.map((i) => (
                    <tr key={i.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-700">
                        {i.nummer || "-"}
                      </td>

                      <td className="px-4 py-2 font-semibold text-slate-950">
                        <Link
                          href={`/admin/instructies/${i.slug}/preview`}
                          className="hover:text-blue-600"
                        >
                          {i.titel}
                        </Link>
                      </td>

                                            <td className="px-4 py-2 text-slate-600">
                        {i.functies && i.functies.length ? (
                          <div className="flex flex-wrap gap-1">
                            {i.functies.map((f, idx) => (
                              <span
                                key={idx}
                                className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700"
                              >
                                {f}
                              </span>
                            ))}
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td className="px-4 py-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-slate-700">
                            {faseLabel(i.onboarding_fase)}
                          </span>
                          {i.onboarding_verplicht ? (
                            <span className="w-fit rounded-full bg-blue-100 px-2 py-0.5 text-xs font-bold text-blue-700">
                              Verplicht
                            </span>
                          ) : (
                            <span className="w-fit rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                              Niet verplicht
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-2 text-slate-600">
                        {i.onboarding_volgorde ?? 999}
                      </td>

                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          <Link
                            href={`/admin/instructies/${i.slug}/edit`}
                            className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                            title="Bewerken"
                          >
                            <Pencil size={16} />
                          </Link>

                          <button
                            onClick={() => verwijder(i.slug, i.titel)}
                            className="inline-flex items-center justify-center rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                            title="Verwijderen"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}