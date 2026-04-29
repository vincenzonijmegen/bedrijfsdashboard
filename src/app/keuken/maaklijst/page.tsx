"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";

type ReceptItem = {
  id: number;
  categorie: string;
  naam: string;
  maakvolgorde: number;
};

type MaaklijstEntry = {
  id: number;
  recept_id: number;
  categorie: string;
  naam: string;
  maakvolgorde: number;
  aantal: number;
  status: "open" | "afgehandeld";
};

type CategorieItem = {
  slug: string;
  naam: string;
  sortering: number;
};

type MaaklijstResponse = {
  success: boolean;
  lijst: {
    id: number;
    datum: string;
    locatie: string;
    status: string;
  } | null;
  items: MaaklijstEntry[];
  openCount: number;
  doneCount: number;
};

function getLocalDateKey(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error || "Fout bij laden");
  }

  return data as T;
}

export default function MaaklijstPage() {
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<ReceptItem | null>(null);
  const [aantal, setAantal] = useState(1);
  const [toevoegenBezig, setToevoegenBezig] = useState(false);
  const [showDeleteId, setShowDeleteId] = useState<number | null>(null);
  const [selectieSortering, setSelectieSortering] = useState<
    "alfabetisch" | "maakvolgorde"
  >("alfabetisch");

  const holdTimer = useRef<number | null>(null);

  const datum = getLocalDateKey();
  const locatie = "keuken";

const {
  data: lijstData,
  error: lijstError,
  mutate,
  isLoading: lijstLoading,
} = useSWR<MaaklijstResponse>(
  `/api/keuken/maaklijst?datum=${datum}&locatie=${locatie}`,
  fetcher,
  {
    refreshInterval: 10000,
    revalidateOnFocus: true,
  }
);

  const {
    data: itemsData,
    error: itemsError,
    isLoading: itemsLoading,
  } = useSWR<{ success: boolean; items: ReceptItem[] }>(
    "/api/keuken/maaklijst-items",
    fetcher
  );

  const {
    data: categorieenData,
    error: categorieenError,
    isLoading: categorieenLoading,
  } = useSWR<{ success: boolean; items: CategorieItem[] }>(
    "/api/keuken/categorieen",
    fetcher
  );

  const items = itemsData?.items || [];
  const categorieen = categorieenData?.items || [];
  const maaklijst = lijstData?.items || [];

  const loading = lijstLoading || itemsLoading || categorieenLoading;

  const combinedError =
    error ||
    (lijstError instanceof Error ? lijstError.message : "") ||
    (itemsError instanceof Error ? itemsError.message : "") ||
    (categorieenError instanceof Error ? categorieenError.message : "");

  function startHold(id: number) {
    clearHold();
    holdTimer.current = window.setTimeout(() => {
      setShowDeleteId(id);
    }, 600);
  }

  function clearHold() {
    if (holdTimer.current !== null) {
      window.clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
  }

  useEffect(() => {
    function handleWindowClick() {
      setShowDeleteId(null);
    }

    window.addEventListener("click", handleWindowClick);
    return () => window.removeEventListener("click", handleWindowClick);
  }, []);

  function getCategorieNaam(slug: string) {
    return categorieen.find((c) => c.slug === slug)?.naam || slug;
  }

  async function markAsDone(item: MaaklijstEntry) {
  try {
    setError("");

    const isEchtRecept = Number(item.recept_id) > 0;

    if (isEchtRecept) {
      const logRes = await fetch("/api/keuken/productie-log", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recept_id: item.recept_id,
          recept_naam: item.naam,
          categorie: item.categorie,
          aantal: item.aantal,
        }),
      });

      const logData = await logRes.json();

      if (!logRes.ok || !logData.success) {
        setError(logData.error || "Logging mislukt");
        return;
      }
    }

    const res = await fetch("/api/keuken/maaklijst/items", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: item.id,
        status: "afgehandeld",
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      setError(data.error || "Wijzigen mislukt");
      return;
    }

    setShowDeleteId(null);
    await mutate();
  } catch (err) {
    console.error(err);
    setError("Afhandelen mislukt");
  }
}

  function isSelected(receptId: number) {
    return maaklijst.some(
      (item) => item.recept_id === receptId && item.status === "open"
    );
  }

  function openAddDialog(item: ReceptItem) {
    setActiveItem(item);
    setAantal(1);
    setDialogOpen(true);
  }

  function closeDialog() {
  if (toevoegenBezig) return;

  setDialogOpen(false);
  setActiveItem(null);
  setAantal(1);
}

async function addToMaaklijst() {
  if (!activeItem) return;
  if (toevoegenBezig) return;

  try {
    setToevoegenBezig(true);
    setError("");

    const res = await fetch("/api/keuken/maaklijst/items", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        datum,
        locatie,
        recept_id: activeItem.id,
        categorie: activeItem.categorie,
        naam: activeItem.naam,
        maakvolgorde: activeItem.maakvolgorde ?? 50,
        aantal,
      }),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      setError(data.error || "Toevoegen mislukt");
      return;
    }

    closeDialog();
    await mutate();
  } catch (err) {
    console.error(err);
    setError("Toevoegen mislukt");
  } finally {
    setToevoegenBezig(false);
  }
}

  async function removeFromMaaklijst(id: number) {
    try {
      setError("");

      const res = await fetch("/api/keuken/maaklijst/items", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || "Verwijderen mislukt");
        return;
      }

      setShowDeleteId(null);
      await mutate();
    } catch (err) {
      console.error(err);
      setError("Verwijderen mislukt");
    }
  }

  async function clearList() {
  try {
    setError("");

    const openItems = maaklijst.filter((item) => item.status === "open");

    await Promise.all(
      openItems.map((item) =>
        fetch("/api/keuken/maaklijst/items", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: item.id }),
        })
      )
    );

    setShowDeleteId(null);
    await mutate();
  } catch (err) {
    console.error(err);
    setError("Wissen mislukt");
  }
}

  const grouped = useMemo(() => {
    function sorteer(recepten: ReceptItem[]) {
      return [...recepten].sort((a, b) => {
        if (selectieSortering === "maakvolgorde") {
          const diff = (a.maakvolgorde ?? 9999) - (b.maakvolgorde ?? 9999);
          if (diff !== 0) return diff;
          return a.naam.localeCompare(b.naam, "nl");
        }

        return a.naam.localeCompare(b.naam, "nl");
      });
    }

    return categorieen
      .map((categorie) => {
        const categorieItems = items.filter(
          (item) => item.categorie === categorie.slug
        );

        return {
          categorie: categorie.slug,
          titel: categorie.naam,
          items: sorteer(categorieItems),
        };
      })
      .filter((groep) => groep.items.length > 0);
  }, [items, categorieen, selectieSortering]);

  const sortedMaaklijst = useMemo(() => {
    return [...maaklijst].sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === "open" ? -1 : 1;
      }

      if (a.maakvolgorde !== b.maakvolgorde) {
        return a.maakvolgorde - b.maakvolgorde;
      }

      return a.naam.localeCompare(b.naam, "nl");
    });
  }, [maaklijst]);

  const openItems = useMemo(() => {
    return sortedMaaklijst.filter((item) => item.status === "open");
  }, [sortedMaaklijst]);

  const doneItems = useMemo(() => {
    return sortedMaaklijst.filter((item) => item.status === "afgehandeld");
  }, [sortedMaaklijst]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cat = params.get("cat");

    if (!cat) return;
    if (grouped.length === 0) return;

    const el = document.getElementById(`cat-${cat}`);
    if (!el) return;

    const timeout = window.setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);

    return () => window.clearTimeout(timeout);
  }, [grouped]);

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-500 shadow-sm">
            Maaklijst laden...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/keuken"
              className="mb-3 inline-flex items-center text-slate-600"
            >
              ← Terug
            </Link>

            <h1 className="text-3xl font-bold text-slate-900 md:text-4xl">
              Maaklijst
            </h1>
            <p className="mt-2 text-slate-600">
              Bekijk bovenaan wat er gemaakt moet worden en voeg onderaan nieuwe
              smaken toe.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-slate-900 px-4 py-3 text-lg font-semibold text-white">
              {openItems.length} open
            </div>

            <button
              type="button"
              onClick={clearList}
              disabled={sortedMaaklijst.length === 0}
              className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-40"
            >
              Wissen
            </button>
          </div>
        </div>

        {combinedError ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {combinedError}
          </div>
        ) : null}

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-slate-900">Te maken</h2>
            <div className="text-sm text-slate-500">{openItems.length} open</div>
          </div>

          {openItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-slate-500">
              Geen open items.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {openItems.map((item) => (
                <div
                  key={item.id}
                onTouchStart={() => startHold(item.id)}
                onTouchEnd={clearHold}
                onTouchCancel={clearHold}
                onMouseDown={() => startHold(item.id)}
                onMouseLeave={clearHold}
                onClick={(e) => e.stopPropagation()}
                  onContextMenu={(e) => e.preventDefault()}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 select-none"
                  style={{ WebkitUserSelect: "none", WebkitTouchCallout: "none" }}
                >
                  <div>
                    <div className="text-lg font-semibold text-slate-900">
                      {item.naam}
                    </div>
                    <div className="text-sm text-slate-500">
                      {getCategorieNaam(item.categorie)}
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-700">
                      {item.aantal}x maken · volgorde {item.maakvolgorde}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Link
                      href={`/keuken/recepturen/${item.categorie}/${item.recept_id}?from=maaklijst&cat=${item.categorie}`}
                      className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                    >
                      Recept
                    </Link>

                    <button
                      type="button"
                      onClick={() => markAsDone(item)}
                      className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white"
                    >
                      Afgehandeld
                    </button>

                    {showDeleteId === item.id && (
                      <button
                        type="button"
                        onClick={() => removeFromMaaklijst(item.id)}
                        className="rounded-xl border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700"
                      >
                        Verwijder
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-bold text-slate-900">Afgehandeld</h2>
            <div className="text-sm text-slate-500">{doneItems.length} klaar</div>
          </div>

          {doneItems.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-slate-500">
              Nog niets afgehandeld.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {doneItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 opacity-75"
                >
                  <div>
                    <div className="text-lg font-semibold text-slate-900">
                      {item.naam}
                    </div>
                    <div className="text-sm text-slate-500">
                      {getCategorieNaam(item.categorie)}
                    </div>
                    <div className="mt-1 text-sm font-medium text-slate-700">
                      {item.aantal}x gemaakt · volgorde {item.maakvolgorde}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="mb-4 mt-6 flex gap-2">
          <button
            type="button"
            onClick={() => setSelectieSortering("alfabetisch")}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              selectieSortering === "alfabetisch"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            Alfabetisch
          </button>

          <button
            type="button"
            onClick={() => setSelectieSortering("maakvolgorde")}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              selectieSortering === "maakvolgorde"
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-700"
            }`}
          >
            Maakvolgorde
          </button>
        </div>

        <div className="mt-8 space-y-8">
          {grouped.map((groep) => (
            <section id={`cat-${groep.categorie}`} key={groep.categorie}>
              <h2 className="mb-3 text-2xl font-semibold text-slate-900">
                {groep.titel}
              </h2>

              <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
                {groep.items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openAddDialog(item)}
                    className={`relative flex h-[96px] items-center justify-center rounded-2xl border px-3 py-3 text-center shadow-sm transition active:scale-95 ${
                      isSelected(item.id)
                        ? "border-emerald-300 bg-emerald-100 text-emerald-900"
                        : "border-slate-200 bg-white text-slate-900"
                    }`}
                  >
                    <span className="block max-w-[170px] text-lg font-semibold leading-snug text-slate-900">
                      {item.naam}
                    </span>

                    {isSelected(item.id) && (
                      <div className="absolute right-2 top-2 rounded-full bg-emerald-600 px-2 py-1 text-xs font-bold text-white">
                        {
                          maaklijst.find(
                            (x) =>
                              x.recept_id === item.id && x.status === "open"
                          )?.aantal
                        }
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>

      {dialogOpen && activeItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <h2 className="text-2xl font-bold text-slate-900">
              {activeItem.naam}
            </h2>
            <p className="mt-2 text-slate-600">Hoeveel wil je maken?</p>

            <div className="mt-6 flex items-center justify-center gap-4">
              <button
                type="button"
                onClick={() => setAantal((prev) => Math.max(1, prev - 1))}
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-300 bg-white text-2xl font-bold text-slate-800"
              >
                −
              </button>

              <div className="min-w-[90px] rounded-2xl bg-slate-100 px-6 py-3 text-center text-2xl font-bold text-slate-900">
                {aantal}
              </div>

              <button
                type="button"
                onClick={() => setAantal((prev) => prev + 1)}
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-300 bg-white text-2xl font-bold text-slate-800"
              >
                +
              </button>
            </div>

            <div className="mt-8 flex gap-3">
              <button
  type="button"
  onClick={closeDialog}
  disabled={toevoegenBezig}
  className="flex-1 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base font-medium text-slate-700 disabled:opacity-50"
>
  Annuleren
</button>

<button
  type="button"
  onClick={addToMaaklijst}
  disabled={toevoegenBezig}
  className="flex-1 rounded-2xl bg-emerald-600 px-4 py-3 text-base font-semibold text-white disabled:bg-slate-300 disabled:text-slate-600"
>
  {toevoegenBezig ? "Toevoegen..." : "Toevoegen"}
</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}