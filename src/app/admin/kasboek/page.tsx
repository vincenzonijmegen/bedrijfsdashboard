'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import {
  format,
  eachDayOfInterval,
  parseISO,
  startOfMonth,
  endOfMonth,
} from 'date-fns';

const fetcher = (url) => fetch(url).then((r) => r.json());

const CATEGORIEEN = [
  { key: 'verkopen_laag', label: 'Verkopen laag', type: 'ontvangst', btw: '9%' },
  { key: 'verkoop_kadobonnen', label: 'Verkoop kadobonnen', type: 'ontvangst', btw: '9%' },
  { key: 'wisselgeld_van_bank', label: 'Wisselgeld van bank', type: 'ontvangst', btw: 'geen' },
  { key: 'prive_opname_herman', label: 'Privé opname Herman', type: 'uitgave', btw: 'geen' },
  { key: 'prive_opname_erik', label: 'Privé opname Erik', type: 'uitgave', btw: 'geen' },
  { key: 'ingenomen_kadobon', label: 'Ingenomen kadobonnen', type: 'uitgave', btw: '9%' },
  { key: 'naar_bank_afgestort', label: 'Naar bank afgestort', type: 'uitgave', btw: 'geen' },
  { key: 'kasverschil', label: 'Kasverschil', type: 'uitgave', btw: 'geen' },
];

export default function KasboekPage() {
  const [datum, setDatum] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const maand = datum.slice(0, 7);
  const [dagId, setDagId] = useState(null);
  const [startbedrag, setStartbedrag] = useState('');
  const [bedragen, setBedragen] = useState({});
  const [inkoopRijen, setInkoopRijen] = useState(['']);

  const { data: dagen } = useSWR(`/api/kasboek/dagen?maand=${maand}`, fetcher);
  const { data: transacties } = useSWR(
    dagId ? `/api/kasboek/dagen/${dagId}/transacties` : null,
    fetcher
  );

  useEffect(() => {
    const bestaande = dagen?.find((d) => d.datum === datum);
    if (bestaande) {
      setDagId(bestaande.id);
      setStartbedrag(bestaande.startbedrag?.toString() || '');
    } else {
      setDagId(null);
      setStartbedrag('');
    }
  }, [datum, dagen]);

  useEffect(() => {
    if (transacties && transacties.length > 0) {
      const nieuweBedragen = {};
      const nieuweInkoop = [];
      transacties.forEach((t) => {
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
    start: startOfMonth(parseISO(`${maand}-01`)),
    end: endOfMonth(parseISO(`${maand}-01`)),
  });

  const opslaan = async () => {
    if (!dagId) return;

    const transacties = [
      ...CATEGORIEEN.map((cat) => {
        const bedrag = bedragen[cat.key];
        return bedrag
          ? {
              type: cat.type,
              categorie: cat.key,
              bedrag: parseFloat(bedrag),
              btw: cat.btw === 'geen' ? null : cat.btw,
              omschrijving: null,
            }
          : null;
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

    await fetch(`/api/kasboek/dagen/${dagId}/transacties`, {
      method: 'PUT',
      body: JSON.stringify(transacties),
    });

    await fetch(`/api/kasboek/dagen/herbereken`, {
      method: 'POST',
      body: JSON.stringify({ vanafDatum: datum }),
    });

    alert('Opgeslagen en herberekend');
  };

  return (
    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl">
      <div>
        <h1 className="text-xl font-bold mb-2">Kasboek {maand}</h1>
        <div className="space-y-1">
          {alleDagenVanMaand.map((dag) => {
            const formatted = format(dag, 'yyyy-MM-dd');
            const record = dagen?.find((d) => d.datum === formatted);
            const status = record && parseInt(record.aantal_transacties) > 0 ? '✅' : '⬜';
            const active = datum === formatted;

            return (
              <div
                key={formatted}
                onClick={() => setDatum(formatted)}
                className={`cursor-pointer px-2 py-1 rounded ${
                  active ? 'bg-blue-100 font-bold' : ''
                }`}
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
                {CATEGORIEEN.map((cat) => (
                  <tr key={cat.key} className="border-t">
                    <td className="px-2 py-1">{cat.label}</td>
                    <td>{cat.type}</td>
                    <td>{cat.btw}</td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        value={bedragen[cat.key] || ''}
                        onChange={(e) =>
                          setBedragen({ ...bedragen, [cat.key]: e.target.value })
                        }
                        className="border px-2 w-32"
                      />
                    </td>
                  </tr>
                ))}
                {inkoopRijen.map((val, i) => (
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
            </table>

            <div className="mt-4">
              <button
                onClick={opslaan}
                className="bg-green-600 text-white px-4 py-2 rounded"
              >
                Sla transacties op
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
