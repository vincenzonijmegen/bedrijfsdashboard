'use client';

import { useState, useEffect, useMemo } from 'react';
import useSWR, { mutate } from 'swr';
import { CATEGORIEEN } from '@/lib/kasboek/constants';
import {
  format,
  eachDayOfInterval,
  parseISO,
  startOfMonth,
  endOfMonth,
  addMonths,
  subMonths,
} from 'date-fns';

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const formatBtw = (btw?: 0 | 9 | 21 | '-') => (btw === '-' || btw == null ? '—' : `${btw}%`);
const toNumber = (v?: string) => {
  const n = parseFloat((v ?? '').toString().replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
const formatEuro = (n: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n);

const SECTION_ORDER: Array<'ontvangst' | 'uitgave' | 'overig'> = ['ontvangst', 'uitgave', 'overig'];
const SECTION_LABEL: Record<'ontvangst' | 'uitgave' | 'overig', string> = {
  ontvangst: 'Ontvangsten',
  uitgave: 'Uitgaven',
  overig: 'Overig',
};

const getDatumKey = (d: any): string | null => {
  const raw = d?.datum ?? d?.date ?? d?.dag ?? null;
  return raw ? String(raw).slice(0, 10) : null;
};
const getTransactieCount = (d: any): number =>
  Number(d?.aantal_transacties ?? d?.aantalTransacties ?? d?.transacties_count ?? 0);

export default function KasboekPage() {
  // ✅ alle hooks binnen de component
  const [datum, setDatum] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [dagId, setDagId] = useState<number | null>(null);
  const [startbedrag, setStartbedrag] = useState('');
  const [bedragen, setBedragen] = useState<Record<string, string>>({});
  const [inkoopRijen, setInkoopRijen] = useState<string[]>(['']);
  const [isCreating, setIsCreating] = useState(false);

  const maandDate = parseISO(`${datum.slice(0, 7)}-01`);
  const vorigeMaand = () => setDatum(format(subMonths(maandDate, 1), 'yyyy-MM-01'));
  const volgendeMaand = () => setDatum(format(addMonths(maandDate, 1), 'yyyy-MM-01'));

  const dagenKey = `/api/kasboek/dagen?maand=${datum.slice(0, 7)}`;
  const { data: dagen, error: dagenError } = useSWR(dagenKey, fetcher);
  const dagenArr = useMemo(() => (Array.isArray(dagen) ? dagen : []), [dagen]);

  const { data: transacties } = useSWR(
    dagId ? `/api/kasboek/dagen/${dagId}/transacties` : null,
    fetcher
  );

  useEffect(() => {
    const bestaande = dagenArr.find((d: any) => getDatumKey(d) === datum);
    if (bestaande) {
      setDagId(bestaande.id);
      setStartbedrag(String(bestaande.startbedrag ?? ''));
    } else {
      setDagId(null);
      setStartbedrag('');
    }
  }, [datum, dagenArr]);

  useEffect(() => {
    if (transacties && transacties.length > 0) {
      const nieuweBedragen: Record<string, string> = {};
      const nieuweInkoop: string[] = [];
      transacties.forEach((t: any) => {
        if (t.categorie === 'contant_inkoop') nieuweInkoop.push(String(t.bedrag));
        else if (t.categorie) nieuweBedragen[t.categorie] = String(t.bedrag);
      });
      setBedragen(nieuweBedragen);
      setInkoopRijen(nieuweInkoop.length > 0 ? nieuweInkoop : ['']);
    } else {
      setBedragen({});
      setInkoopRijen(['']);
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
      if (cat.type === 'ontvangst') ontvangsten += val;
      if (cat.type === 'uitgave') uitgaven += val;
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

  const eindsaldo = useMemo(
    () => toNumber(startbedrag) + totals.netto,
    [startbedrag, totals.netto]
  );

  const groupedCats = useMemo(() => {
    const byType: Record<'ontvangst' | 'uitgave' | 'overig', typeof CATEGORIEEN> = {
      ontvangst: [],
      uitgave: [],
      overig: [],
    };
    CATEGORIEEN.forEach((c) => byType[c.type].push(c));
    return byType;
  }, []);

  const opslaan = async () => {
    if (!dagId) return;
    const transactiesPayload = [
      ...CATEGORIEEN.map((cat) => {
        const bedrag = bedragen[cat.key];
        if (!bedrag) return null;
        return {
          type: cat.type,
          categorie: cat.key,
          bedrag: parseFloat(bedrag),
          btw: cat.btw === '-' ? null : `${cat.btw}%`,
          omschrijving: null,
        };
      }).filter(Boolean),
      ...inkoopRijen.filter(Boolean).map((val) => ({
        type: 'uitgave',
        categorie: 'contant_inkoop',
        bedrag: parseFloat(val),
        btw: null,
        omschrijving: null,
      })),
    ];

    await fetch(`/api/kasboek/dagen/${dagId}/transacties`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(transactiesPayload),
    });

    await fetch(`/api/kasboek/dagen/herbereken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ vanafDatum: datum }),
    });

    alert('Opgeslagen en herberekend');
    mutate(dagenKey);
  };

const maakDagAan = async () => {
  try {
    setIsCreating(true);
    const res = await fetch(`/api/kasboek/dagen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ datum }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      alert(`Dag aanmaken mislukt: ${err?.error || res.statusText}`);
      return;
    }

    const data = await res.json();
    // ✅ Optimistisch: direct in de UI zetten
    setDagId(data.id);
    setStartbedrag(String(data.startbedrag ?? ''));
    setBedragen({});
    setInkoopRijen(['']);

    // daarna SWR verversen zodat de linkerkant ook up-to-date is
    await mutate(dagenKey, undefined, { revalidate: true });
  } finally {
    setIsCreating(false);
  }
};


  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl">
      <div>
        {dagenError && (
          <div className="text-red-600 mb-2">
            Kan dagen niet laden (server gaf {String((dagenError as any)?.status || 500)}).
          </div>
        )}

        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold">Kasboek {datum.slice(0, 7)}</h1>
          <div className="space-x-2">
            <button onClick={vorigeMaand} className="px-2 py-1 border rounded">←</button>
            <button onClick={volgendeMaand} className="px-2 py-1 border rounded">→</button>
          </div>
        </div>

        {dagenArr.length === 0 && !dagenError && (
          <div className="text-gray-500 mb-2">
            Geen dagen gevonden voor {datum.slice(0, 7)}. Klik “Dag aanmaken” om te starten.
          </div>
        )}

        <div className="space-y-1">
          {alleDagenVanMaand.map((dag) => {
            const formatted = format(dag, 'yyyy-MM-dd');
            const record = dagenArr.find((d: any) => getDatumKey(d) === formatted);
            // ✅ laat ook het aantal zien om te debuggen
            const count = getTransactieCount(record);
            const status = count > 0 ? `✅` : '⬜';
            const active = datum === formatted;
            return (
              <div
                key={formatted}
                onClick={() => setDatum(formatted)}
                className={`cursor-pointer px-2 py-1 rounded ${active ? 'bg-blue-100 font-bold' : ''}`}
              >
                {status} {formatted}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <h2 className="font-semibold text-lg mb-2">Geselecteerde dag: {datum}</h2>
        <p className="mb-2">Startbedrag: € {startbedrag || '–'}</p>

        {!dagId && (
          <button
            onClick={maakDagAan}
            className="px-3 py-1 border rounded mb-3 disabled:opacity-50"
            disabled={isCreating}
          >
            {isCreating ? 'Bezig…' : 'Dag aanmaken'}
          </button>
        )}

        {dagId && (
          <>
            <table className="w-full text-sm border mt-2">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left px-2 py-1">Categorie</th>
                  <th>Type</th>
                  <th>BTW</th>
                  <th>Bedrag</th>
                </tr>
              </thead>
              <tbody>
                {SECTION_ORDER.map((typeKey) => (
                  <>
                    <tr className="bg-gray-100/70 border-t">
                      <td className="px-2 py-1 font-semibold" colSpan={4}>
                        {SECTION_LABEL[typeKey]}
                      </td>
                    </tr>
                    {groupedCats[typeKey].map((cat) => {
                      const key = cat.key;
                      return (
                        <tr key={key} className="border-t">
                          <td className="px-2 py-1">{cat.label ?? key}</td>
                          <td>{cat.type ?? '—'}</td>
                          <td>{formatBtw(cat.btw)}</td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              value={bedragen[key] || ''}
                              onChange={(e) =>
                                setBedragen({ ...bedragen, [key]: e.target.value })
                              }
                              className="border px-2 w-32"
                            />
                          </td>
                        </tr>
                      );
                    })}
                    {typeKey === 'uitgave' &&
                      inkoopRijen.map((val, i) => (
                        <tr key={`inkoop-${i}`} className="border-t">
                          <td className="px-2 py-1">Contant betaalde inkoop</td>
                          <td>uitgave</td>
                          <td>–</td>
                          <td>
                            <input
                              type="number"
                              step="0.01"
                              value={val}
                              onChange={(e) => {
                                const kopie = [...inkoopRijen];
                                kopie[i] = e.target.value;
                                setInkoopRijen(kopie);
                              }}
                              className="border px-2 w-32"
                            />
                          </td>
                        </tr>
                      ))}
                  </>
                ))}
                <tr>
                  <td colSpan={4}>
                    <button
                      className="text-blue-600 underline px-2 mt-2"
                      onClick={() => setInkoopRijen([...inkoopRijen, ''])}
                    >
                      + Extra inkoopregel
                    </button>
                  </td>
                </tr>
              </tbody>
              <tfoot className="bg-gray-50">
                <tr className="border-t">
                  <td className="px-2 py-1 font-semibold" colSpan={3}>Totaal ontvangsten</td>
                  <td className="px-2 py-1 font-semibold">{formatEuro(totals.ontvangsten)}</td>
                </tr>
                <tr>
                  <td colSpan={3}>Totaal uitgaven (excl. contante inkoop)</td>
                  <td>{formatEuro(totals.uitgavenZonderInkoop)}</td>
                </tr>
                <tr>
                  <td colSpan={3}>Contant betaalde inkoop</td>
                  <td>{formatEuro(totals.inkoop)}</td>
                </tr>
                <tr className="border-t">
                  <td className="px-2 py-1 font-semibold" colSpan={3}>Totaal uitgaven</td>
                  <td className="px-2 py-1 font-semibold">{formatEuro(totals.uitgavenTotaal)}</td>
                </tr>
                <tr>
                  <td colSpan={3}>Netto (ontvangsten − uitgaven)</td>
                  <td>{formatEuro(totals.netto)}</td>
                </tr>
                <tr className="border-t">
                  <td className="px-2 py-1 font-bold" colSpan={3}>Eindsaldo (start + netto)</td>
                  <td className="px-2 py-1 font-bold">{formatEuro(eindsaldo)}</td>
                </tr>
              </tfoot>
            </table>
            <div className="mt-4">
              <button onClick={opslaan} className="bg-green-600 text-white px-4 py-2 rounded">
                Sla transacties op
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
