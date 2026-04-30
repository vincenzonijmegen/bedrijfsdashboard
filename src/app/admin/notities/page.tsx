"use client";

import { useState, useEffect, useMemo } from "react";
import useSWR from "swr";
import dynamic from "next/dynamic";
import {
  BookOpenText,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

const NotitieEditor = dynamic(() => import("@/components/NotitieEditor"), {
  ssr: false,
});

const fetcher = (url: string) =>
  fetch(url, { cache: "no-store" }).then((res) => res.json());

interface Rubriek {
  id: number;
  naam: string;
}

interface Notitie {
  id: number;
  rubriek_id: number;
  tekst: string;
  volgorde: number;
}

const stripHTML = (html: string) => {
  if (typeof document === "undefined") return "";
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
};

const isHtmlEmpty = (html: string) =>
  !html || !html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim();

function NotitieRow({
  n,
  onSaved,
  onDelete,
}: {
  n: Notitie;
  onSaved: () => void;
  onDelete: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [html, setHtml] = useState<string>(n.tekst);

  useEffect(() => {
    if (!editing) setHtml(n.tekst);
  }, [n.tekst, editing]);

  const handleSave = async () => {
    await fetch("/api/notities", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: n.id, tekst: html, type: "notitie" }),
    });

    setEditing(false);
    onSaved();
  };

  const handleCancel = () => {
    setHtml(n.tekst);
    setEditing(false);
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:border-blue-200 hover:shadow-md">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <div className="text-sm font-medium text-slate-600">
          {editing ? "Notitie bewerken" : "Notitie"}
        </div>

        <div className="flex items-center gap-2">
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
            >
              <Pencil size={15} />
              Bewerken
            </button>
          )}

          {editing && (
            <>
              <button
                onClick={handleSave}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
              >
                <Save size={15} />
                Opslaan
              </button>

              <button
                onClick={handleCancel}
                className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                <X size={15} />
                Annuleren
              </button>
            </>
          )}

          <button
            onClick={() => onDelete(n.id)}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
            title="Notitie verwijderen"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {editing ? (
        <div className="min-h-[180px]">
          <NotitieEditor
            value={html}
            onChange={setHtml}
            editable
            placeholder="Schrijf je notitie…"
          />
        </div>
      ) : (
        <div
          className="prose max-w-none min-h-[8rem] w-full resize-y overflow-auto p-5 text-base text-slate-800"
          style={{ resize: "vertical" }}
          title={stripHTML(html)}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}

export default function NotitieblokPagina() {
  const { data: rubrieken = [], mutate: mutateRubrieken } = useSWR<Rubriek[]>(
    "/api/notities",
    fetcher,
    {
      revalidateOnMount: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  const sortedRubrieken = useMemo(
    () => [...rubrieken].sort((a, b) => a.naam.localeCompare(b.naam)),
    [rubrieken]
  );

  const [selRubriek, setSelRubriek] = useState<Rubriek | null>(null);

  const { data: notities = [], mutate: mutateNotities } = useSWR<Notitie[]>(
    selRubriek ? `/api/notities?rubriek_id=${selRubriek.id}` : null,
    fetcher,
    {
      revalidateOnMount: true,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30000,
    }
  );

  const [newRubriekName, setNewRubriekName] = useState("");
  const [newNotitieHtml, setNewNotitieHtml] = useState("");

  useEffect(() => {
    if (sortedRubrieken.length && !selRubriek) {
      setSelRubriek(sortedRubrieken[0]);
    }
  }, [sortedRubrieken, selRubriek]);

  const addRubriek = async () => {
    if (!newRubriekName.trim()) return;

    await fetch("/api/notities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ naam: newRubriekName.trim() }),
    });

    setNewRubriekName("");
    mutateRubrieken();
  };

  const editRubriek = async (r: Rubriek) => {
    const nieuw = prompt("Nieuwe naam voor rubriek:", r.naam);

    if (nieuw?.trim() && nieuw !== r.naam) {
      await fetch("/api/notities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: r.id,
          naam: nieuw.trim(),
          type: "rubriek",
        }),
      });

      setSelRubriek((prev) =>
        prev && prev.id === r.id ? { ...prev, naam: nieuw.trim() } : prev
      );

      mutateRubrieken();
    }
  };

  const deleteRubriek = async (r: Rubriek) => {
    if (!confirm(`Rubriek "${r.naam}" verwijderen?`)) return;

    await fetch("/api/notities", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: r.id, type: "rubriek" }),
    });

    if (selRubriek?.id === r.id) setSelRubriek(null);
    mutateRubrieken();
  };

  const addNotitie = async () => {
    if (isHtmlEmpty(newNotitieHtml) || !selRubriek) return;

    await fetch("/api/notities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rubriek_id: selRubriek.id,
        tekst: newNotitieHtml,
      }),
    });

    setNewNotitieHtml("");
    await mutateNotities();
  };

  const deleteNotitie = async (id: number) => {
    if (!confirm("Notitie verwijderen?")) return;

    await fetch("/api/notities", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, type: "notitie" }),
    });

    mutateNotities();
  };

  return (
    <div className="min-h-screen bg-slate-100 px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mb-1 flex items-center gap-2 text-sm font-medium text-blue-600">
                <BookOpenText className="h-4 w-4" />
                Management / Notities
              </div>

              <h1 className="text-2xl font-bold tracking-tight text-slate-950">
                Notitieblok
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                Interne notities netjes per rubriek gegroepeerd.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-blue-50 px-4 py-3 ring-1 ring-blue-100">
                <div className="text-xs font-medium uppercase tracking-wide text-blue-600">
                  Rubrieken
                </div>
                <div className="text-2xl font-bold text-blue-950">
                  {rubrieken.length}
                </div>
              </div>

              <div className="rounded-xl bg-emerald-50 px-4 py-3 ring-1 ring-emerald-100">
                <div className="text-xs font-medium uppercase tracking-wide text-emerald-600">
                  Notities
                </div>
                <div className="text-2xl font-bold text-emerald-950">
                  {notities.length}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <aside className="space-y-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Rubrieken
              </h2>

              <div className="space-y-2">
                {sortedRubrieken.map((r) => {
                  const actief = selRubriek?.id === r.id;

                  return (
                    <div key={r.id} className="flex items-center gap-2">
                      <button
                        onClick={() => setSelRubriek(r)}
                        className={`flex min-w-0 flex-1 items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                          actief
                            ? "bg-blue-600 font-semibold text-white shadow-sm"
                            : "bg-slate-50 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/70 text-blue-700">
                          <BookOpenText size={15} />
                        </span>
                        <span className="truncate">{r.naam}</span>
                      </button>

                      <button
                        onClick={() => editRubriek(r)}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600"
                        title="Rubriek aanpassen"
                      >
                        <Pencil size={16} />
                      </button>

                      <button
                        onClick={() => deleteRubriek(r)}
                        className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                        title="Rubriek verwijderen"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}

                {sortedRubrieken.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                    Nog geen rubrieken.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">
                Nieuwe rubriek
              </h3>

              <div className="space-y-2">
                <input
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                  placeholder="Bijv. Personeel"
                  value={newRubriekName}
                  onChange={(e) => setNewRubriekName(e.target.value)}
                />

                <button
                  onClick={addRubriek}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"
                >
                  <Plus size={16} />
                  Nieuwe rubriek
                </button>
              </div>
            </div>
          </aside>

          <main className="space-y-6">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-xl font-bold text-slate-950">
                  Notities voor “{selRubriek?.naam ?? "—"}”
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {notities.length} notitie{notities.length === 1 ? "" : "s"} in
                  deze rubriek.
                </p>
              </div>

              <div className="space-y-4">
                {notities.map((n) => (
                  <NotitieRow
                    key={n.id}
                    n={n}
                    onSaved={mutateNotities}
                    onDelete={deleteNotitie}
                  />
                ))}

                {notities.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                    Geen notities in deze rubriek.
                  </div>
                )}
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    Nieuwe notitie
                  </h3>

                  <p className="text-xs text-slate-500">
                    Voeg een notitie toe aan de geselecteerde rubriek.
                  </p>
                </div>

                <button
                  onClick={addNotitie}
                  disabled={!selRubriek}
                  className="ml-auto inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  <Plus size={16} />
                  Notitie
                </button>
              </div>

              <div className="min-h-[170px]">
                <NotitieEditor
                  value={newNotitieHtml}
                  onChange={setNewNotitieHtml}
                  editable
                  placeholder="Schrijf je notitie…"
                />
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}