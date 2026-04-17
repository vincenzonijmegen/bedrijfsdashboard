import { NextRequest, NextResponse } from 'next/server';
import { query as dbQuery } from '@/lib/db';

export const dynamic = 'force-dynamic';

const NORM = (alias: string) =>
  `to_date(substr(${alias}.datum::text, 1, 10), 'YYYY-MM-DD')`;

const ONTVANGSTEN = [
  { key: 'verkopen_laag', label: 'Omzet 9%', btw: 9 },
  { key: 'verkoop_kadobonnen', label: 'Verkoop kadobonnen', btw: 9 },
  { key: 'wisselgeld_van_bank', label: 'Wisselgeld van bank', btw: null },
  { key: 'kosten_wisselgeld', label: 'Kosten wisselgeld', btw: null },
] as const;

const UITGAVEN = [
  { key: 'prive_opname_herman', label: 'Prive opnamen Herman', btw: null },
  { key: 'prive_opname_erik', label: 'Prive opnamen Erik', btw: null },
  { key: 'ingenomen_kadobon', label: 'Ingenomen kadobonnen', btw: 9 },
  { key: 'contant_inkoop', label: 'Contant betaalde inkopen', btw: null },
  { key: 'pinbetalingen', label: 'Pinbetalingen', btw: null },
  { key: 'naar_bank_afgestort', label: 'Naar bank afgestort', btw: null },
  { key: 'kasverschil', label: 'Kasverschil', btw: null },
] as const;

type DagRow = {
  dag_id: number;
  datum: string;
  iso_week: string;
  iso_year: string;
  iso_dow: number;
  weekdag: string;
  startbedrag: string | number;
  eindsaldo: string | number;
  totaal_ontvangsten: string | number;
  totaal_uitgaven: string | number;
  verkopen_laag: string | number;
  verkoop_kadobonnen: string | number;
  wisselgeld_van_bank: string | number;
  kosten_wisselgeld: string | number;
  prive_opname_herman: string | number;
  prive_opname_erik: string | number;
  ingenomen_kadobon: string | number;
  contant_inkoop: string | number;
  pinbetalingen: string | number;
  naar_bank_afgestort: string | number;
  kasverschil: string | number;
};

function toNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function emptyWeekCategoryMap<T extends readonly { key: string; label: string; btw: number | null }[]>(
  defs: T
) {
  return Object.fromEntries(
    defs.map((d) => [
      d.key,
      {
        label: d.label,
        btw: d.btw,
        dagen: [0, 0, 0, 0, 0, 0, 0],
        weekTotaal: 0,
      },
    ])
  ) as Record<
    T[number]['key'],
    { label: string; btw: number | null; dagen: number[]; weekTotaal: number }
  >;
}

export async function GET(req: NextRequest) {
  const jaar = req.nextUrl.searchParams.get('jaar');
  const week = req.nextUrl.searchParams.get('week');

  if (!jaar || !/^\d{4}$/.test(jaar)) {
    return NextResponse.json(
      { error: 'Geef ?jaar=YYYY mee' },
      { status: 400 }
    );
  }

  if (week && !/^\d{1,2}$/.test(week)) {
    return NextResponse.json(
      { error: 'week moet 1 t/m 53 zijn' },
      { status: 400 }
    );
  }

  const sql = `
    SELECT
      d.id AS dag_id,
      to_char(${NORM('d')}, 'YYYY-MM-DD') AS datum,
      to_char(${NORM('d')}, 'IYYY') AS iso_year,
      to_char(${NORM('d')}, 'IW') AS iso_week,
      EXTRACT(ISODOW FROM ${NORM('d')})::int AS iso_dow,
      CASE EXTRACT(ISODOW FROM ${NORM('d')})::int
        WHEN 1 THEN 'maandag'
        WHEN 2 THEN 'dinsdag'
        WHEN 3 THEN 'woensdag'
        WHEN 4 THEN 'donderdag'
        WHEN 5 THEN 'vrijdag'
        WHEN 6 THEN 'zaterdag'
        WHEN 7 THEN 'zondag'
      END AS weekdag,

      COALESCE(d.startbedrag, 0)::numeric(12,2) AS startbedrag,
      COALESCE(d.eindsaldo, 0)::numeric(12,2) AS eindsaldo,

      COALESCE(SUM(CASE WHEN t.type = 'ontvangst' THEN t.bedrag ELSE 0 END), 0)::numeric(12,2) AS totaal_ontvangsten,
      COALESCE(SUM(CASE WHEN t.type = 'uitgave'   THEN t.bedrag ELSE 0 END), 0)::numeric(12,2) AS totaal_uitgaven,

      COALESCE(SUM(CASE WHEN t.categorie = 'verkopen_laag'        THEN t.bedrag ELSE 0 END), 0)::numeric(12,2) AS verkopen_laag,
      COALESCE(SUM(CASE WHEN t.categorie = 'verkoop_kadobonnen'   THEN t.bedrag ELSE 0 END), 0)::numeric(12,2) AS verkoop_kadobonnen,
      COALESCE(SUM(CASE WHEN t.categorie = 'wisselgeld_van_bank'  THEN t.bedrag ELSE 0 END), 0)::numeric(12,2) AS wisselgeld_van_bank,
      COALESCE(SUM(CASE WHEN t.categorie = 'kosten_wisselgeld'    THEN t.bedrag ELSE 0 END), 0)::numeric(12,2) AS kosten_wisselgeld,

      COALESCE(SUM(CASE WHEN t.categorie = 'prive_opname_herman'  THEN t.bedrag ELSE 0 END), 0)::numeric(12,2) AS prive_opname_herman,
      COALESCE(SUM(CASE WHEN t.categorie = 'prive_opname_erik'    THEN t.bedrag ELSE 0 END), 0)::numeric(12,2) AS prive_opname_erik,
      COALESCE(SUM(CASE WHEN t.categorie = 'ingenomen_kadobon'    THEN t.bedrag ELSE 0 END), 0)::numeric(12,2) AS ingenomen_kadobon,
      COALESCE(SUM(CASE WHEN t.categorie = 'contant_inkoop'       THEN t.bedrag ELSE 0 END), 0)::numeric(12,2) AS contant_inkoop,
      COALESCE(SUM(CASE WHEN t.categorie = 'pinbetalingen'        THEN t.bedrag ELSE 0 END), 0)::numeric(12,2) AS pinbetalingen,
      COALESCE(SUM(CASE WHEN t.categorie = 'naar_bank_afgestort'  THEN t.bedrag ELSE 0 END), 0)::numeric(12,2) AS naar_bank_afgestort,
      COALESCE(SUM(CASE WHEN t.categorie = 'kasverschil'          THEN t.bedrag ELSE 0 END), 0)::numeric(12,2) AS kasverschil

    FROM kasboek_dagen d
    LEFT JOIN kasboek_transacties t ON t.dag_id = d.id
    WHERE to_char(${NORM('d')}, 'IYYY') = $1
      ${week ? `AND to_char(${NORM('d')}, 'IW') = lpad($2, 2, '0')` : ''}
    GROUP BY d.id, ${NORM('d')}, d.startbedrag, d.eindsaldo
    ORDER BY ${NORM('d')} ASC
  `;

  try {
    const params = week ? [jaar, week] : [jaar];
    const res = await dbQuery(sql, params);
    const rows = res.rows as DagRow[];

    const wekenMap = new Map<
      string,
      {
        weekNr: number;
        isoJaar: number;
        dagen: Array<{
          datum: string;
          weekdag: string;
          dagIndex: number;
          beginsaldo: number;
          ontvangsten: Record<string, number>;
          uitgaven: Record<string, number>;
          totaalOntvangsten: number;
          totaalUitgaven: number;
          eindsaldo: number;
        }>;
        beginsaldoKas: number | null;
        totaalOntvangsten: number;
        totaalUitgaven: number;
        eindsaldoKas: number | null;
        ontvangsten: ReturnType<typeof emptyWeekCategoryMap<typeof ONTVANGSTEN>>;
        uitgaven: ReturnType<typeof emptyWeekCategoryMap<typeof UITGAVEN>>;
      }
    >();

    for (const row of rows) {
      const weekNr = Number(row.iso_week);
      const isoJaar = Number(row.iso_year);
      const weekKey = `${isoJaar}-${String(weekNr).padStart(2, '0')}`;
      const dagIndex = Number(row.iso_dow) - 1;

      if (!wekenMap.has(weekKey)) {
        wekenMap.set(weekKey, {
          weekNr,
          isoJaar,
          dagen: [],
          beginsaldoKas: null,
          totaalOntvangsten: 0,
          totaalUitgaven: 0,
          eindsaldoKas: null,
          ontvangsten: emptyWeekCategoryMap(ONTVANGSTEN),
          uitgaven: emptyWeekCategoryMap(UITGAVEN),
        });
      }

      const weekObj = wekenMap.get(weekKey)!;

      const dagOntvangsten: Record<string, number> = {};
      for (const def of ONTVANGSTEN) {
        const bedrag = toNum(row[def.key as keyof DagRow]);
        dagOntvangsten[def.key] = bedrag;
        weekObj.ontvangsten[def.key].dagen[dagIndex] = bedrag;
        weekObj.ontvangsten[def.key].weekTotaal += bedrag;
      }

      const dagUitgaven: Record<string, number> = {};
      for (const def of UITGAVEN) {
        const bedrag = toNum(row[def.key as keyof DagRow]);
        dagUitgaven[def.key] = bedrag;
        weekObj.uitgaven[def.key].dagen[dagIndex] = bedrag;
        weekObj.uitgaven[def.key].weekTotaal += bedrag;
      }

      const beginsaldo = toNum(row.startbedrag);
      const totaalOntvangsten = toNum(row.totaal_ontvangsten);
      const totaalUitgaven = toNum(row.totaal_uitgaven);
      const eindsaldo = toNum(row.eindsaldo);

      weekObj.dagen.push({
        datum: row.datum,
        weekdag: row.weekdag,
        dagIndex,
        beginsaldo,
        ontvangsten: dagOntvangsten,
        uitgaven: dagUitgaven,
        totaalOntvangsten,
        totaalUitgaven,
        eindsaldo,
      });

      if (weekObj.beginsaldoKas == null) {
        weekObj.beginsaldoKas = beginsaldo;
      }

      weekObj.totaalOntvangsten += totaalOntvangsten;
      weekObj.totaalUitgaven += totaalUitgaven;
      weekObj.eindsaldoKas = eindsaldo;
    }

    const weken = Array.from(wekenMap.values()).map((w) => {
      const dagenOpVolgorde = [...w.dagen].sort((a, b) => a.dagIndex - b.dagIndex);

      const btw = {
        laag9: {
          percentage: 9,
          ontvangstenInclBtw:
            toNum(w.ontvangsten.verkopen_laag?.weekTotaal ?? 0) +
            toNum(w.ontvangsten.verkoop_kadobonnen?.weekTotaal ?? 0),
          uitgavenInclBtw: toNum(w.uitgaven.ingenomen_kadobon?.weekTotaal ?? 0),
        },
      };

      const grondslag9 = btw.laag9.ontvangstenInclBtw - btw.laag9.uitgavenInclBtw;
      const btwBedrag9 = Math.round((grondslag9 - grondslag9 / 1.09) * 100) / 100;

      return {
        weekNr: w.weekNr,
        isoJaar: w.isoJaar,
        beginsaldoKas: toNum(w.beginsaldoKas ?? 0),
        totaalOntvangsten: toNum(w.totaalOntvangsten),
        totaalUitgaven: toNum(w.totaalUitgaven),
        eindsaldoKas: toNum(w.eindsaldoKas ?? 0),
        dagen: dagenOpVolgorde,
        ontvangsten: w.ontvangsten,
        uitgaven: w.uitgaven,
        btw: {
          laag9: {
            percentage: 9,
            inclBtw: Math.round(grondslag9 * 100) / 100,
            bedrag: btwBedrag9,
          },
        },
      };
    });

    const jaarTotalen = weken.reduce(
      (acc, w) => {
        acc.totaalOntvangsten += w.totaalOntvangsten;
        acc.totaalUitgaven += w.totaalUitgaven;
        acc.eindsaldoKas = w.eindsaldoKas;
        if (acc.beginsaldoKas == null) acc.beginsaldoKas = w.beginsaldoKas;
        return acc;
      },
      {
        beginsaldoKas: null as number | null,
        totaalOntvangsten: 0,
        totaalUitgaven: 0,
        eindsaldoKas: 0,
      }
    );

    return NextResponse.json({
      jaar: Number(jaar),
      weekFilter: week ? Number(week) : null,
      categorieen: {
        ontvangsten: ONTVANGSTEN,
        uitgaven: UITGAVEN,
      },
      weken,
      totalen: {
        beginsaldoKas: toNum(jaarTotalen.beginsaldoKas ?? 0),
        totaalOntvangsten: toNum(jaarTotalen.totaalOntvangsten),
        totaalUitgaven: toNum(jaarTotalen.totaalUitgaven),
        eindsaldoKas: toNum(jaarTotalen.eindsaldoKas),
      },
    });
  } catch (e) {
    console.error('GET /api/kasboek/kasstaat error', e);
    return NextResponse.json(
      { error: 'Kon kasstaat niet ophalen' },
      { status: 500 }
    );
  }
}