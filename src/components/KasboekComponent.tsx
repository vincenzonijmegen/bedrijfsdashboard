"use client";

import { useState, useEffect, useMemo } from "react";
import useSWR, { mutate } from "swr";
import { CATEGORIEEN } from "@/lib/kasboek/constants";
import {
  format,
  eachDayOfInterval,
  parseISO,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
} from "date-fns";

// ====== JOURNAALPOST COMPONENT ======
function Journaalpost({ maand }: { maand: string }) {
  const [regels, setRegels] = useState<
    { gb: string; omschrijving: string; bedrag: number }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!maand) return;
    setLoading(true);
    setError(null);
    fetch(`/api/kasboek/journaal?maand=${maand}`)
      .then((r) => r.json())
      .then((data) => {
        if (data && Array.isArray(data.regels)) setRegels(data.regels);
        else setError("Geen regels gevonden");
      })
      .catch(() => setError("Fout bij ophalen journaalpost"))
      .finally(() => setLoading(false));
  }, [maand]);

  if (!maand) return null;

  return (
    <section className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="text-lg font-bold">
          Maandelijkse journaalpost – {maand}
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          Verkochte cadeaubonnen gaan naar 2215. Ingenomen cadeaubonnen vallen
          vrij naar omzet en btw.
        </p>
      </div>

      <div className="p-5">
        {loading && (
          <div className="mb-2 text-sm text-gray-600">
            Journaalpost wordt opgehaald...
          </div>
        )}
        {error && <div className="text-red-700 mb-2 text-sm">{error}</div>}
        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200 rounded-lg overflow-hidden">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left px-3 py-2 w-28">Grootboek</th>
                  <th className="text-left px-3 py-2">Omschrijving</th>
                  <th className="text-right px-3 py-2 w-40">Bedrag</th>
                </tr>
              </thead>
              <tbody>
                {regels.map((r, i) => (
                  <tr
                    key={i}
                    className={
                      r.gb === ""
                        ? "bg-yellow-100 font-medium"
                        : r.gb === "0000"
                          ? "italic text-blue-700"
                          : "border-t border-gray-100"
                    }
                  >
                    <td className="px-3 py-2 whitespace-nowrap">{r.gb}</td>
                    <td className="px-3 py-2">{r.omschrijving}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap font-medium">
                      {r.bedrag.toLocaleString("nl-NL", {
                        style: "currency",
                        currency: "EUR",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
// ====== EINDE JOURNAALPOST ======

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const formatBtw = (btw?: 0 | 9 | 21 | "-") =>
  btw === "-" || btw == null ? "—" : `${btw}%`;

const toNumber = (v?: string) => {
  const n = parseFloat((v ?? "").toString().replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};

const formatEuro = (n: number) =>
  new Intl.NumberFormat("nl-NL", { style: "currency", currency: "EUR" }).format(
    n,
  );

const BON_CATEGORIE_KEYS = new Set(["verkoop_kadobonnen", "ingenomen_kadobon"]);

const KAS_NEUTRALE_CATEGORIEEN = new Set([
  "verkoop_kadobonnen",
  "ingenomen_kadobon",
]);

const rijStijl = (key: string) => {
  if (key === "verkopen_laag") return "border-blue-200 bg-blue-50";
  if (key === "verkoop_kadobonnen" || key === "ingenomen_kadobon") {
    return "border-amber-200 bg-amber-50";
  }
  if (key === "prive_opname_herman" || key === "prive_opname_erik")
    return "border-purple-200 bg-purple-50";
  if (key === "wisselgeld_van_bank" || key === "naar_bank_afgestort")
    return "border-orange-200 bg-orange-50";
  if (key === "kasverschil") return "border-red-200 bg-red-50";
  return "border-gray-200 bg-white";
};

const kasLabel = (key: string, type?: string) => {
  if (KAS_NEUTRALE_CATEGORIEEN.has(key)) return "Kas-neutraal";
  if (type === "ontvangst") return "Kas erbij";
  if (type === "uitgave") return "Kas eruit";
  return "—";
};

const btwLabel = (key: string, btw?: 0 | 9 | 21 | "-") => {
  if (key === "verkoop_kadobonnen") return "MPV";
  return formatBtw(btw);
};

export default function KasboekComponent({
  alleenLezen = false,
}: {
  alleenLezen?: boolean;
}) {
  const [datum, setDatum] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [dagId, setDagId] = useState<number | null>(null);
  const [startbedrag, setStartbedrag] = useState("");
  const [bedragen, setBedragen] = useState<Record<string, string>>({});
  const [inkoopRijen, setInkoopRijen] = useState<string[]>([""]);

  const [isCreating, setIsCreating] = useState(false);
  const [isOpslaan, setIsOpslaan] = useState(false);
  const [isHerberekenen, setIsHerberekenen] = useState(false);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({
    open: false,
    message: "",
  });

  const maandDate = parseISO(`${datum.slice(0, 7)}-01`);
  const vorigeMaand = () =>
    setDatum(format(subMonths(maandDate, 1), "yyyy-MM-01"));
  const volgendeMaand = () =>
    setDatum(format(addMonths(maandDate, 1), "yyyy-MM-01"));

  const dagenKey = `/api/kasboek/dagen?maand=${datum.slice(0, 7)}`;
  const { data: dagen, mutate: mutateDagen } = useSWR(dagenKey, fetcher);
  const dagenArr = Array.isArray(dagen) ? dagen : [];

  const { data: transacties } = useSWR(
    dagId ? `/api/kasboek/dagen/${dagId}/transacties` : null,
    fetcher,
  );

  useEffect(() => {
    const bestaande = dagenArr.find((d: any) => d.datum === datum);
    if (bestaande) {
      setDagId(bestaande.id);
      setStartbedrag(bestaande.startbedrag?.toString() || "");
    } else {
      setDagId(null);
      setStartbedrag("");
    }
  }, [datum, dagenArr]);

  useEffect(() => {
    if (transacties && transacties.length > 0) {
      const nieuweBedragen: Record<string, string> = {};
      const nieuweInkoop: string[] = [];
      transacties.forEach((t: any) => {
        if (t.categorie === "contant_inkoop") {
          nieuweInkoop.push(t.bedrag.toString());
        } else {
          nieuweBedragen[t.categorie] = t.bedrag.toString();
        }
      });
      setBedragen(nieuweBedragen);
      setInkoopRijen(nieuweInkoop.length > 0 ? nieuweInkoop : [""]);
    } else {
      setBedragen({});
      setInkoopRijen([""]);
    }
  }, [transacties]);

  const alleDagenVanMaand = eachDayOfInterval({
    start: startOfMonth(maandDate),
    end: endOfMonth(maandDate),
  });

  const totals = useMemo(() => {
    let ontvangsten = 0;
    let uitgaven = 0;
    const inkoop = inkoopRijen.reduce((sum, val) => sum + toNumber(val), 0);

    CATEGORIEEN.forEach((cat) => {
      const val = toNumber(bedragen[cat.key]);

      // Kadobonnen beïnvloeden het fysieke kassaldo niet.
      // Verkochte kadobonnen behandelen we pragmatisch als pin/neutraal;
      // eventuele contante bonverkoop corrigeren we later via rapportage/memoriaal.
      // Ingenomen kadobonnen zijn MPV-vrijval/omzetlogica en geen kasbeweging.
      if (KAS_NEUTRALE_CATEGORIEEN.has(cat.key)) return;

      if (cat.type === "ontvangst") ontvangsten += val;
      if (cat.type === "uitgave") uitgaven += val;
    });

    const uitgavenTotaal = uitgaven + inkoop;

    return {
      ontvangsten,
      uitgavenZonderInkoop: uitgaven,
      inkoop,
      uitgavenTotaal,
      netto: ontvangsten - uitgavenTotaal,
    };
  }, [bedragen, inkoopRijen]);

  const eindsaldo = useMemo(() => {
    const start = toNumber(startbedrag);
    return start + totals.netto;
  }, [startbedrag, totals.netto]);

  const showSnackbar = (message: string) => {
    setSnackbar({ open: true, message });
    setTimeout(() => {
      setSnackbar({ open: false, message: "" });
    }, 3000);
  };

  const herbereken = async () => {
    try {
      setIsHerberekenen(true);
      const res = await fetch(`/api/kasboek/dagen/herbereken`, {
        method: "POST",
        body: JSON.stringify({ vanafDatum: datum }),
      });
      if (!res.ok) throw new Error("Fout bij herberekenen");
      await mutateDagen();
      return true;
    } catch {
      return false;
    } finally {
      setIsHerberekenen(false);
    }
  };

  const opslaan = async () => {
    if (!dagId) return;
    try {
      setIsOpslaan(true);

      const payload = [
        ...CATEGORIEEN.map((cat) => {
          const bedrag = bedragen[cat.key];
          if (!bedrag) return null;
          return {
            type: cat.type,
            categorie: cat.key,
            bedrag: parseFloat(bedrag),
            btw: cat.btw === "-" ? null : `${cat.btw}%`,
            omschrijving: null,
          };
        }).filter(Boolean),
        ...inkoopRijen
          .filter((val) => val)
          .map((val) => ({
            type: "uitgave",
            categorie: "contant_inkoop",
            bedrag: parseFloat(val),
            btw: null,
            omschrijving: null,
          })),
      ];

      const putRes = await fetch(`/api/kasboek/dagen/${dagId}/transacties`, {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      if (!putRes.ok) throw new Error("Opslaan mislukt");

      const ok = await herbereken();
      if (!ok) throw new Error("Herberekenen mislukt");

      await mutate(`/api/kasboek/dagen/${dagId}/transacties`);

      showSnackbar("Transacties opgeslagen en herberekend");
    } catch (e) {
      showSnackbar((e as Error)?.message || "Opslaan mislukt");
    } finally {
      setIsOpslaan(false);
    }
  };

  const maakDagAan = async () => {
    try {
      setIsCreating(true);
      const res = await fetch(`/api/kasboek/dagen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ datum }),
      });
      if (!res.ok) throw new Error("Fout bij dag aanmaken");
      const data = await res.json();
      setDagId(data.id);
      setStartbedrag(String(data.startbedrag ?? ""));
      setBedragen({});
      setInkoopRijen([""]);
      await mutateDagen();
      showSnackbar("Dag aangemaakt");
    } catch {
      showSnackbar("Dag aanmaken mislukt");
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6 items-start">
        <aside className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold">Kasboek</h1>
              <p className="text-sm text-gray-500">{datum.slice(0, 7)}</p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={vorigeMaand}
                className="w-9 h-9 border rounded-lg hover:bg-gray-50"
              >
                ←
              </button>
              <button
                onClick={volgendeMaand}
                className="w-9 h-9 border rounded-lg hover:bg-gray-50"
              >
                →
              </button>
            </div>
          </div>

          {dagenArr.length === 0 && (
            <div className="text-gray-500 text-sm p-4 border-b border-gray-100">
              Geen dagen gevonden voor {datum.slice(0, 7)}. Klik “Dag aanmaken”
              om te starten.
            </div>
          )}

          <div className="p-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-1 max-h-[620px] overflow-auto">
            {alleDagenVanMaand.map((dag) => {
              const formatted = format(dag, "yyyy-MM-dd");
              const record = dagenArr.find((d: any) => d.datum === formatted);
              const count =
                typeof record?.aantal_transacties === "number"
                  ? record.aantal_transacties
                  : parseInt(record?.aantal_transacties as any, 10) || 0;
              const status = count > 0 ? "✅" : "⬜";
              const active = datum === formatted;

              return (
                <button
                  key={formatted}
                  type="button"
                  onClick={() => setDatum(formatted)}
                  className={`text-left px-3 py-2 rounded-lg text-sm transition ${
                    active
                      ? "bg-blue-100 font-bold text-blue-950"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <span className="mr-2">{status}</span>
                  {formatted}
                </button>
              );
            })}
          </div>
        </aside>

        <main className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            <div>
              <h2 className="font-bold text-xl">Geselecteerde dag: {datum}</h2>
              <p className="text-sm text-gray-600 mt-1">
                Startbedrag:{" "}
                <span className="font-semibold text-gray-900">
                  {startbedrag ? formatEuro(toNumber(startbedrag)) : "–"}
                </span>
              </p>
            </div>

            {!dagId && !alleenLezen && (
              <button
                onClick={maakDagAan}
                className="px-4 py-2 border rounded-lg bg-white hover:bg-gray-50 disabled:opacity-50"
                disabled={isCreating}
              >
                {isCreating ? "Bezig…" : "Dag aanmaken"}
              </button>
            )}
          </div>

          {dagId && (
            <div className="p-5 space-y-5">
              <div className="space-y-5">
                <section className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
                  <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
                    <h3 className="font-bold text-gray-950">
                      Fysieke kasbewegingen
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Alleen deze regels kunnen het verwachte kassaldo verhogen
                      of verlagen.
                    </p>
                  </div>

                  <div className="hidden md:grid grid-cols-[1fr_130px_90px_160px] gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wide text-gray-500 border-b border-gray-100">
                    <div>Categorie</div>
                    <div>Kas-effect</div>
                    <div>BTW</div>
                    <div className="text-right">Bedrag</div>
                  </div>

                  <div className="divide-y divide-gray-100">
                    {CATEGORIEEN.filter(
                      (cat) => !BON_CATEGORIE_KEYS.has(cat.key),
                    ).map((cat) => {
                      const key = cat.key;

                      return (
                        <div
                          key={key}
                          className={`grid grid-cols-[1fr_130px] md:grid-cols-[1fr_130px_90px_160px] gap-2 items-center px-4 py-3 ${rijStijl(key)}`}
                        >
                          <div>
                            <div className="font-medium text-gray-950">
                              {cat.label ?? key}
                            </div>
                            <div className="md:hidden mt-1 flex flex-wrap gap-1 text-xs">
                              <span className="rounded-full px-2 py-0.5 bg-white text-gray-700 border border-gray-200">
                                {kasLabel(key, cat.type)}
                              </span>
                              <span className="rounded-full px-2 py-0.5 bg-white text-gray-700 border border-gray-200">
                                BTW: {btwLabel(key, cat.btw)}
                              </span>
                            </div>
                          </div>

                          <div className="hidden md:block">
                            <span className="rounded-full px-2 py-1 text-xs font-medium bg-white text-gray-700 border border-gray-200">
                              {kasLabel(key, cat.type)}
                            </span>
                          </div>

                          <div className="hidden md:block text-sm font-medium text-gray-700">
                            {btwLabel(key, cat.btw)}
                          </div>

                          <input
                            type="number"
                            step="0.01"
                            value={bedragen[key] || ""}
                            onChange={(e) =>
                              setBedragen({
                                ...bedragen,
                                [key]: e.target.value,
                              })
                            }
                            className="border border-gray-300 rounded-lg px-3 py-2 w-full text-right bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            disabled={alleenLezen}
                          />
                        </div>
                      );
                    })}

                    {inkoopRijen.map((val, i) => (
                      <div
                        key={`inkoop-${i}`}
                        className="grid grid-cols-[1fr_130px] md:grid-cols-[1fr_130px_90px_160px] gap-2 items-center px-4 py-3 border-green-200 bg-green-50"
                      >
                        <div className="font-medium text-gray-950">
                          Contant betaalde inkoop
                        </div>
                        <div className="hidden md:block">
                          <span className="rounded-full px-2 py-1 text-xs font-medium bg-white text-gray-700 border border-gray-200">
                            Kas eruit
                          </span>
                        </div>
                        <div className="hidden md:block text-sm font-medium text-gray-700">
                          —
                        </div>
                        <input
                          type="number"
                          step="0.01"
                          value={val}
                          onChange={(e) => {
                            const kopie = [...inkoopRijen];
                            kopie[i] = e.target.value;
                            setInkoopRijen(kopie);
                          }}
                          className="border border-gray-300 rounded-lg px-3 py-2 w-full text-right bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          disabled={alleenLezen}
                        />
                      </div>
                    ))}
                  </div>

                  {!alleenLezen && (
                    <div className="px-4 py-3 border-t border-gray-100">
                      <button
                        type="button"
                        className="text-blue-700 underline text-sm"
                        onClick={() => setInkoopRijen([...inkoopRijen, ""])}
                      >
                        + Extra inkoopregel
                      </button>
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-amber-200 bg-amber-50 overflow-hidden">
                  <div className="px-4 py-3 bg-amber-100/70 border-b border-amber-200">
                    <h3 className="font-bold text-amber-950">Cadeaubonnen</h3>
                    <p className="text-xs text-amber-900 mt-1">
                      MPV: verkoop is waarde/verplichting op 2215. Omzet en btw
                      ontstaan pas bij inlevering. Geen van beide regels
                      beïnvloedt de fysieke kas.
                    </p>
                  </div>

                  <div className="hidden md:grid grid-cols-[1fr_130px_90px_160px] gap-2 px-4 py-2 text-xs font-bold uppercase tracking-wide text-amber-900 border-b border-amber-200">
                    <div>Categorie</div>
                    <div>Kas-effect</div>
                    <div>BTW</div>
                    <div className="text-right">Bedrag</div>
                  </div>

                  <div className="divide-y divide-amber-200">
                    {CATEGORIEEN.filter((cat) =>
                      BON_CATEGORIE_KEYS.has(cat.key),
                    ).map((cat) => {
                      const key = cat.key;

                      return (
                        <div
                          key={key}
                          className="grid grid-cols-[1fr_130px] md:grid-cols-[1fr_130px_90px_160px] gap-2 items-center px-4 py-3 bg-amber-50"
                        >
                          <div>
                            <div className="font-medium text-amber-950">
                              {cat.label ?? key}
                            </div>
                            <div className="md:hidden mt-1 flex flex-wrap gap-1 text-xs">
                              <span className="rounded-full px-2 py-0.5 bg-white text-amber-800 border border-amber-200">
                                Kas-neutraal
                              </span>
                              <span className="rounded-full px-2 py-0.5 bg-white text-amber-800 border border-amber-200">
                                {key === "verkoop_kadobonnen"
                                  ? "MPV / geen btw"
                                  : "BTW bij inlevering: 9%"}
                              </span>
                            </div>
                          </div>

                          <div className="hidden md:block">
                            <span className="rounded-full px-2 py-1 text-xs font-medium bg-white text-amber-800 border border-amber-200">
                              Kas-neutraal
                            </span>
                          </div>

                          <div className="hidden md:block text-sm font-medium text-amber-900">
                            {key === "verkoop_kadobonnen" ? "MPV" : "9%"}
                          </div>

                          <input
                            type="number"
                            step="0.01"
                            value={bedragen[key] || ""}
                            onChange={(e) =>
                              setBedragen({
                                ...bedragen,
                                [key]: e.target.value,
                              })
                            }
                            className="border border-amber-300 rounded-lg px-3 py-2 w-full text-right bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                            disabled={alleenLezen}
                          />
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl border border-green-200 bg-green-50 p-4">
                  <div className="text-sm text-gray-600">Kas erbij</div>
                  <div className="text-xl font-bold mt-1">
                    {formatEuro(totals.ontvangsten)}
                  </div>
                </div>
                <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                  <div className="text-sm text-gray-600">Kas eruit</div>
                  <div className="text-xl font-bold mt-1">
                    {formatEuro(totals.uitgavenTotaal)}
                  </div>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <div className="text-sm text-gray-600">
                    Verwacht eindsaldo fysieke kas
                  </div>
                  <div className="text-xl font-bold mt-1">
                    {formatEuro(eindsaldo)}
                  </div>
                </div>
              </div>

              {!alleenLezen && (
                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <button
                    onClick={opslaan}
                    className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg disabled:opacity-50"
                    disabled={isOpslaan}
                  >
                    {isOpslaan ? "Opslaan..." : "Sla transacties op"}
                  </button>
                  <button
                    onClick={herbereken}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg disabled:opacity-50"
                    disabled={isHerberekenen}
                  >
                    {isHerberekenen ? "Herberekenen..." : "Herbereken"}
                  </button>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <Journaalpost maand={datum.slice(0, 7)} />

      {snackbar.open && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded shadow">
          {snackbar.message}
        </div>
      )}
    </div>
  );
}     
