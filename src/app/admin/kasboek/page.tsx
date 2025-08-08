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

function Journaalpost({ maand }: { maand: string }) {
  const [regels, setRegels] = useState<{ gb: string; omschrijving: string; bedrag: number }[]>([]);
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
        else setError('Geen regels gevonden');
      })
      .catch(() => setError('Fout bij ophalen journaalpost'))
      .finally(() => setLoading(false));
  }, [maand]);

  if (!maand) return null;

  return (
    <div className="mt-8 bg-white p-4 rounded shadow max-w-3xl">
      <h2 className="text-lg font-bold mb-2">
        Maandelijkse journaalpost – {maand}
      </h2>
      {loading && <div className="mb-2">Journaalpost wordt opgehaald...</div>}
      {error && <div className="text-red-700 mb-2">{error}</div>}
      {!loading && !error && (
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left px-2 py-1">Grootboek</th>
              <th className="text-left px-2 py-1">Omschrijving</th>
              <th className="text-right px-2 py-1">Bedrag</th>
            </tr>
          </thead>
          <tbody>
            {regels.map((r, i) => (
    <tr
      key={i}
      className={
        r.gb === ''
          ? 'bg-yellow-100'
          : r.gb === '0000'
            ? 'italic text-blue-700'
            : ''
      }
    >
      <td className="px-2 py-1">{r.gb}</td>
      <td className="px-2 py-1">{r.omschrijving}</td>
      <td className="px-2 py-1 text-right">
        {r.bedrag.toLocaleString('nl-NL', { style: 'currency', currency: 'EUR' })}
      </td>
    </tr>
  ))}
</tbody>
        </table>
      )}
    </div>
  );
}



const fetcher = (url: string) => fetch(url).then((r) => r.json());
const formatBtw = (btw?: 0 | 9 | 21 | '-') =>
  btw === '-' || btw == null ? '—' : `${btw}%`;

const toNumber = (v?: string) => {
  const n = parseFloat((v ?? '').toString().replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const formatEuro = (n: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(n);

export default function KasboekPage() {
  const [datum, setDatum] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [dagId, setDagId] = useState<number | null>(null);
  const [startbedrag, setStartbedrag] = useState('');
  const [bedragen, setBedragen] = useState<Record<string, string>>({});
  const [inkoopRijen, setInkoopRijen] = useState<string[]>(['']);

  const [isCreating, setIsCreating] = useState(false);
  const [isOpslaan, setIsOpslaan] = useState(false);
  const [isHerberekenen, setIsHerberekenen] = useState(false);

  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  });

  const maandDate = parseISO(`${datum.slice(0, 7)}-01`);
  const vorigeMaand = () => setDatum(format(subMonths(maandDate, 1), 'yyyy-MM-01'));
  const volgendeMaand = () => setDatum(format(addMonths(maandDate, 1), 'yyyy-MM-01'));

  const dagenKey = `/api/kasboek/dagen?maand=${datum.slice(0, 7)}`;
  const { data: dagen, mutate: mutateDagen } = useSWR(dagenKey, fetcher);
  const dagenArr = Array.isArray(dagen) ? dagen : [];

  const { data: transacties } = useSWR(
    dagId ? `/api/kasboek/dagen/${dagId}/transacties` : null,
    fetcher
  );

  useEffect(() => {
    const bestaande = dagenArr.find((d: any) => d.datum === datum);
    if (bestaande) {
      setDagId(bestaande.id);
      setStartbedrag(bestaande.startbedrag?.toString() || '');
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
        if (t.categorie === 'contant_inkoop') {
          nieuweInkoop.push(t.bedrag.toString());
        } else {
          nieuweBedragen[t.categorie] = t.bedrag.toString();
        }
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

  const eindsaldo = useMemo(() => {
    const start = toNumber(startbedrag);
    return start + totals.netto;
  }, [startbedrag, totals.netto]);

  const showSnackbar = (message: string) => {
    setSnackbar({ open: true, message });
    setTimeout(() => {
      setSnackbar({ open: false, message: '' });
    }, 3000);
  };

  const herbereken = async () => {
    try {
      setIsHerberekenen(true);
      const res = await fetch(`/api/kasboek/dagen/herbereken`, {
        method: 'POST',
        body: JSON.stringify({ vanafDatum: datum }),
      });
      if (!res.ok) throw new Error('Fout bij herberekenen');
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
            btw: cat.btw === '-' ? null : `${cat.btw}%`,
            omschrijving: null,
          };
        }).filter(Boolean),
        ...inkoopRijen
          .filter((val) => val)
          .map((val) => ({
            type: 'uitgave',
            categorie: 'contant_inkoop',
            bedrag: parseFloat(val),
            btw: null,
            omschrijving: null,
          })),
      ];

      const putRes = await fetch(`/api/kasboek/dagen/${dagId}/transacties`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      if (!putRes.ok) throw new Error('Opslaan mislukt');

      const ok = await herbereken();
      if (!ok) throw new Error('Herberekenen mislukt');

      await mutate(`/api/kasboek/dagen/${dagId}/transacties`);

      showSnackbar('Transacties opgeslagen en herberekend');
    } catch (e) {
      showSnackbar((e as Error)?.message || 'Opslaan mislukt');
    } finally {
      setIsOpslaan(false);
    }
  };

  const maakDagAan = async () => {
    try {
      setIsCreating(true);
      const res = await fetch(`/api/kasboek/dagen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ datum }),
      });
      if (!res.ok) throw new Error('Fout bij dag aanmaken');
      const data = await res.json();
      setDagId(data.id);
      setStartbedrag(String(data.startbedrag ?? ''));
      setBedragen({});
      setInkoopRijen(['']);
      await mutateDagen();
      showSnackbar('Dag aangemaakt');
    } catch {
      showSnackbar('Dag aanmaken mislukt');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-6xl">
      <div>
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-xl font-bold">Kasboek {datum.slice(0, 7)}</h1>
          <div className="space-x-2">
            <button onClick={vorigeMaand} className="px-2 py-1 border rounded">←</button>
            <button onClick={volgendeMaand} className="px-2 py-1 border rounded">→</button>
          </div>
        </div>

        {dagenArr.length === 0 && (
          <div className="text-gray-500 mb-2">
            Geen dagen gevonden voor {datum.slice(0, 7)}. Klik “Dag aanmaken” om te starten.
          </div>
        )}

        <div className="space-y-1">
          {alleDagenVanMaand.map((dag) => {
            const formatted = format(dag, 'yyyy-MM-dd');
            const record = dagenArr.find((d: any) => d.datum === formatted);
            const count = typeof record?.aantal_transacties === 'number'
              ? record.aantal_transacties
              : parseInt(record?.aantal_transacties as any, 10) || 0;
            const status = count > 0 ? '✅' : '⬜';
            const active = datum === formatted;

            return (
<div
  key={formatted}
  onClick={() => setDatum(formatted)}
  className={`cursor-pointer px-2 py-0.5 rounded text-sm leading-tight ${active ? 'bg-blue-100 font-bold' : ''}`}
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
{CATEGORIEEN.map((cat) => {
  const key = cat.key;
  let kleur = '';
  if (key === 'verkopen_laag') kleur = 'bg-blue-50';
  if (key === 'verkoop_kadobonnen' || key === 'ingenomen_kadobon') kleur = 'bg-yellow-50';
  if (key === 'prive_opname_herman' || key === 'prive_opname_erik') kleur = 'bg-purple-50';
  if (key === 'wisselgeld_van_bank' || key === 'naar_bank_afgestort') kleur = 'bg-orange-50';
  if (key === 'kasverschil') kleur = 'bg-red-50';
  // contant_inkoop wordt apart hieronder gemapt!
  return (
    <tr key={key} className={`border-t ${kleur}`}>
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
{inkoopRijen.map((val, i) => (
  <tr key={`inkoop-${i}`} className="border-t bg-green-100">
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
                </tr>
                <tr>
                </tr>
                <tr className="border-t">
                  <td className="px-2 py-1 font-semibold" colSpan={3}>Totaal uitgaven</td>
                  <td className="px-2 py-1 font-semibold">{formatEuro(totals.uitgavenTotaal)}</td>
                </tr>
                <tr>
                </tr>
                <tr className="border-t">
                  <td className="px-2 py-1 font-bold" colSpan={3}>Eindsaldo (start + netto)</td>
                  <td className="px-2 py-1 font-bold">{formatEuro(eindsaldo)}</td>
                </tr>
              </tfoot>
            </table>

            <div className="mt-4 space-x-2">
              <button
                onClick={opslaan}
                className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
                disabled={isOpslaan}
              >
                {isOpslaan ? 'Opslaan...' : 'Sla transacties op'}
              </button>
              <button
                onClick={herbereken}
                className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
                disabled={isHerberekenen}
              >
                {isHerberekenen ? 'Herberekenen...' : 'Herbereken'}
              </button>
            </div>
          </>
        )}
      </div>

      {snackbar.open && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded shadow">
          {snackbar.message}
        </div>
      )}
      <Journaalpost maand={datum.slice(0, 7)} />
    </div>
  );
}
