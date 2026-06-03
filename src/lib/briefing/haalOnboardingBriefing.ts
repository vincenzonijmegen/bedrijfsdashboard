// src/lib/briefing/haalOnboardingBriefing.ts

import { db } from "@/lib/db";

export type OnboardingBriefingItem = {
  medewerker_email: string;
  medewerker_naam: string | null;
  nummer: string | null;
  titel: string;
  status?: string;
  verzonden_op?: string | null;
  afgerond_op?: string | null;
  laatste_fout?: string | null;
};

export type OnboardingBriefingData = {
  samenvatting: {
    verzondenVandaag: number;
    afgerondSindsGisteren: number;
    openNaVerzending: number;
    langerDanDrieDagenOpen: number;
    verzendfouten: number;
  };
  verzondenVandaag: OnboardingBriefingItem[];
  afgerondSindsGisteren: OnboardingBriefingItem[];
  openNaVerzending: OnboardingBriefingItem[];
  langerDanDrieDagenOpen: OnboardingBriefingItem[];
  fouten: OnboardingBriefingItem[];
};

function rowToItem(row: any): OnboardingBriefingItem {
  return {
    medewerker_email: row.medewerker_email,
    medewerker_naam: row.medewerker_naam,
    nummer: row.nummer,
    titel: row.titel,
    status: row.status,
    verzonden_op: row.verzonden_op,
    afgerond_op: row.afgerond_op,
    laatste_fout: row.laatste_fout,
  };
}

export async function haalOnboardingBriefing(): Promise<OnboardingBriefingData> {
  const verzondenVandaagResult = await db.query(`
    SELECT
      o.medewerker_email,
      m.naam AS medewerker_naam,
      i.nummer,
      i.titel,
      o.status,
      o.verzonden_op,
      o.afgerond_op,
      o.laatste_fout
    FROM onboarding_opdrachten o
    LEFT JOIN medewerkers m
      ON LOWER(m.email) = LOWER(o.medewerker_email)
    LEFT JOIN instructies i
      ON i.id = o.instructie_id
    WHERE o.verzonden_op::date = CURRENT_DATE
    ORDER BY o.verzonden_op DESC
    LIMIT 25
  `);

  const afgerondSindsGisterenResult = await db.query(`
    SELECT
      o.medewerker_email,
      m.naam AS medewerker_naam,
      i.nummer,
      i.titel,
      o.status,
      o.verzonden_op,
      o.afgerond_op,
      o.laatste_fout
    FROM onboarding_opdrachten o
    LEFT JOIN medewerkers m
      ON LOWER(m.email) = LOWER(o.medewerker_email)
    LEFT JOIN instructies i
      ON i.id = o.instructie_id
    WHERE o.status = 'afgerond'
      AND o.afgerond_op >= CURRENT_DATE - INTERVAL '1 day'
    ORDER BY o.afgerond_op DESC
    LIMIT 25
  `);

  const openNaVerzendingResult = await db.query(`
    SELECT
      o.medewerker_email,
      m.naam AS medewerker_naam,
      i.nummer,
      i.titel,
      o.status,
      o.verzonden_op,
      o.afgerond_op,
      o.laatste_fout
    FROM onboarding_opdrachten o
    LEFT JOIN medewerkers m
      ON LOWER(m.email) = LOWER(o.medewerker_email)
    LEFT JOIN instructies i
      ON i.id = o.instructie_id
    WHERE o.status = 'verzonden'
    ORDER BY o.verzonden_op ASC
    LIMIT 25
  `);

  const langerDanDrieDagenOpenResult = await db.query(`
    SELECT
      o.medewerker_email,
      m.naam AS medewerker_naam,
      i.nummer,
      i.titel,
      o.status,
      o.verzonden_op,
      o.afgerond_op,
      o.laatste_fout
    FROM onboarding_opdrachten o
    LEFT JOIN medewerkers m
      ON LOWER(m.email) = LOWER(o.medewerker_email)
    LEFT JOIN instructies i
      ON i.id = o.instructie_id
    WHERE o.status = 'verzonden'
      AND o.verzonden_op < NOW() - INTERVAL '3 days'
    ORDER BY o.verzonden_op ASC
    LIMIT 25
  `);

  const foutenResult = await db.query(`
    SELECT
      o.medewerker_email,
      m.naam AS medewerker_naam,
      i.nummer,
      i.titel,
      o.status,
      o.verzonden_op,
      o.afgerond_op,
      o.laatste_fout
    FROM onboarding_opdrachten o
    LEFT JOIN medewerkers m
      ON LOWER(m.email) = LOWER(o.medewerker_email)
    LEFT JOIN instructies i
      ON i.id = o.instructie_id
    WHERE o.laatste_fout IS NOT NULL
      AND o.laatste_fout <> ''
      AND o.status <> 'afgerond'
    ORDER BY o.bijgewerkt_op DESC
    LIMIT 25
  `);

  const verzondenVandaag = verzondenVandaagResult.rows.map(rowToItem);
  const afgerondSindsGisteren =
    afgerondSindsGisterenResult.rows.map(rowToItem);
  const openNaVerzending = openNaVerzendingResult.rows.map(rowToItem);
  const langerDanDrieDagenOpen =
    langerDanDrieDagenOpenResult.rows.map(rowToItem);
  const fouten = foutenResult.rows.map(rowToItem);

  return {
    samenvatting: {
      verzondenVandaag: verzondenVandaag.length,
      afgerondSindsGisteren: afgerondSindsGisteren.length,
      openNaVerzending: openNaVerzending.length,
      langerDanDrieDagenOpen: langerDanDrieDagenOpen.length,
      verzendfouten: fouten.length,
    },
    verzondenVandaag,
    afgerondSindsGisteren,
    openNaVerzending,
    langerDanDrieDagenOpen,
    fouten,
  };
}