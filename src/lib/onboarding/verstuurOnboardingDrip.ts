// src/lib/onboarding/verstuurOnboardingDrip.ts

import { Resend } from "resend";
import { db } from "@/lib/db";

const resend = new Resend(process.env.RESEND_API_KEY);

const FASE_VOLGORDE: Record<string, number> = {
  voor_eerste_shift: 1,
  binnen_2_weken: 2,
  taakgericht: 3,
};

function normalizeFuncties(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);

  if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }

  return [];
}

function medewerkerFuncties(medewerker: any): string[] {
  const functies = new Set<string>();
  const hoofdFunctie = String(medewerker.functie || "").trim();

  if (hoofdFunctie) {
    functies.add(hoofdFunctie);
  }

  if (hoofdFunctie === "scheppers overdag + avond") {
    functies.add("scheppers overdag");
  }

  if (
    medewerker.kan_scheppen &&
    hoofdFunctie !== "scheppers overdag" &&
    hoofdFunctie !== "scheppers overdag + avond"
  ) {
    functies.add("scheppers overdag");
  }

  if (medewerker.kan_voorbereiden) {
    functies.add("ijsvoorbereiders");
  }

  if (medewerker.kan_ijsbereiden) {
    functies.add("keukenmedewerkers");
  }

  return Array.from(functies);
}

function instructieHoortBijMedewerker(
  instructie: any,
  functiesMedewerker: string[]
) {
  const functiesInstructie = normalizeFuncties(instructie.functies);

  if (functiesInstructie.length === 0) {
    return false;
  }

  return functiesInstructie.some((functie) =>
    functiesMedewerker.includes(functie)
  );
}

function toDatumString(value: unknown) {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const raw = String(value).trim();

  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    return raw.slice(0, 10);
  }

  const parsed = new Date(raw);

  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return new Date().toISOString().slice(0, 10);
}

function beschikbaarVanaf(medewerker: any, instructie: any) {
  const fase = String(instructie.onboarding_fase || "taakgericht");

  if (fase === "binnen_2_weken" && medewerker.eerste_werkdag) {
    return toDatumString(medewerker.eerste_werkdag);
  }

  return new Date().toISOString().slice(0, 10);
}

function tekstZonderHtml(html: string) {
  return String(html || "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function schoneInstructieHtml(html: string) {
  return String(html || "")
    .replace(/\[end\]/gi, "")
    .replace(/<p>\s*<\/p>/gi, "")
    .trim();
}

async function instructieHeeftVragen(instructieId: string) {
  const result = await db.query(
    `
    SELECT EXISTS (
      SELECT 1
      FROM instructie_vragen
      WHERE instructie_id = $1
        AND actief = true
    ) AS heeft_vragen
    `,
    [instructieId]
  );

  return Boolean(result.rows[0]?.heeft_vragen);
}

export async function bouwOnboardingWachtrijBij() {
  const medewerkersResult = await db.query(`
    SELECT
      id,
      TRIM(naam) AS naam,
      email,
      functie,
      eerste_werkdag,
      COALESCE(kan_scheppen, false) AS kan_scheppen,
      COALESCE(kan_voorbereiden, false) AS kan_voorbereiden,
      COALESCE(kan_ijsbereiden, false) AS kan_ijsbereiden
    FROM medewerkers
    WHERE email IS NOT NULL
      AND email <> ''
    ORDER BY naam
  `);

  const instructiesResult = await db.query(`
    SELECT
      id,
      titel,
      slug,
      nummer,
      functies,
      inhoud,
      COALESCE(onboarding_fase, 'taakgericht') AS onboarding_fase,
      COALESCE(onboarding_verplicht, false) AS onboarding_verplicht,
      COALESCE(onboarding_volgorde, 999) AS onboarding_volgorde
    FROM instructies
    WHERE status = 'actief'
      AND COALESCE(onboarding_verplicht, false) = true
    ORDER BY
      CASE COALESCE(onboarding_fase, 'taakgericht')
        WHEN 'voor_eerste_shift' THEN 1
        WHEN 'binnen_2_weken' THEN 2
        WHEN 'taakgericht' THEN 3
        ELSE 99
      END,
      COALESCE(onboarding_volgorde, 999),
      nummer ASC NULLS LAST,
      titel ASC
  `);

  const gelezenResult = await db.query(`
    SELECT
      LOWER(email) AS email,
      instructie_id
    FROM gelezen_instructies
  `);

  const gelezenSet = new Set(
    gelezenResult.rows.map(
      (row) => `${row.email}::${String(row.instructie_id)}`
    )
  );

  let aangemaakt = 0;
  let alGelezenAfgerond = 0;

  for (const medewerker of medewerkersResult.rows) {
    const email = String(medewerker.email || "").trim().toLowerCase();
    const functies = medewerkerFuncties(medewerker);

    if (!email || functies.length === 0) continue;

    const verplichteInstructies = instructiesResult.rows
      .filter((instructie) => instructieHoortBijMedewerker(instructie, functies))
      .sort((a, b) => {
        const fase =
          (FASE_VOLGORDE[a.onboarding_fase] || 99) -
          (FASE_VOLGORDE[b.onboarding_fase] || 99);

        if (fase !== 0) return fase;

        const volgorde =
          Number(a.onboarding_volgorde || 999) -
          Number(b.onboarding_volgorde || 999);

        if (volgorde !== 0) return volgorde;

        return String(a.nummer || "").localeCompare(String(b.nummer || ""));
      });

    for (const instructie of verplichteInstructies) {
      const alGelezen = gelezenSet.has(`${email}::${String(instructie.id)}`);
      const vanaf = beschikbaarVanaf(medewerker, instructie);

      await db.query(
        `
        INSERT INTO onboarding_opdrachten (
          medewerker_email,
          instructie_id,
          status,
          beschikbaar_vanaf,
          afgerond_op
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          CASE WHEN $3 = 'afgerond' THEN NOW() ELSE NULL END
        )
        ON CONFLICT (medewerker_email, instructie_id)
        DO UPDATE SET
          status = CASE
            WHEN onboarding_opdrachten.status = 'afgerond' THEN 'afgerond'
            WHEN EXCLUDED.status = 'afgerond' THEN 'afgerond'
            ELSE onboarding_opdrachten.status
          END,
          afgerond_op = CASE
            WHEN EXCLUDED.status = 'afgerond'
              THEN COALESCE(onboarding_opdrachten.afgerond_op, NOW())
            ELSE onboarding_opdrachten.afgerond_op
          END,
          beschikbaar_vanaf = LEAST(
            onboarding_opdrachten.beschikbaar_vanaf,
            EXCLUDED.beschikbaar_vanaf
          ),
          bijgewerkt_op = NOW()
        `,
        [email, instructie.id, alGelezen ? "afgerond" : "wacht", vanaf]
      );

      if (alGelezen) {
        alGelezenAfgerond += 1;
      } else {
        aangemaakt += 1;
      }
    }
  }

  return {
    aangemaakt,
    alGelezenAfgerond,
  };
}

async function haalTeVersturenOpdrachten(limit: number) {
  const result = await db.query(
    `
    WITH kandidaten AS (
      SELECT DISTINCT ON (o.medewerker_email)
        o.id,
        o.medewerker_email,
        o.instructie_id,
        o.token,
        o.beschikbaar_vanaf,
        m.naam AS medewerker_naam,
        i.titel,
        i.nummer,
        i.slug,
        i.inhoud,
        COALESCE(i.onboarding_fase, 'taakgericht') AS onboarding_fase,
        COALESCE(i.onboarding_volgorde, 999) AS onboarding_volgorde
      FROM onboarding_opdrachten o
      JOIN medewerkers m
        ON LOWER(m.email) = LOWER(o.medewerker_email)
      JOIN instructies i
        ON i.id = o.instructie_id
      WHERE o.status = 'wacht'
        AND o.beschikbaar_vanaf <= CURRENT_DATE
        AND NOT EXISTS (
          SELECT 1
          FROM onboarding_opdrachten openstaand
          WHERE openstaand.medewerker_email = o.medewerker_email
            AND openstaand.status = 'verzonden'
        )
        AND NOT EXISTS (
          SELECT 1
          FROM onboarding_opdrachten vandaag
          WHERE vandaag.medewerker_email = o.medewerker_email
            AND vandaag.verzonden_op::date = CURRENT_DATE
        )
      ORDER BY
        o.medewerker_email,
        CASE COALESCE(i.onboarding_fase, 'taakgericht')
          WHEN 'voor_eerste_shift' THEN 1
          WHEN 'binnen_2_weken' THEN 2
          WHEN 'taakgericht' THEN 3
          ELSE 99
        END,
        COALESCE(i.onboarding_volgorde, 999),
        i.nummer ASC NULLS LAST,
        i.titel ASC
    )
    SELECT *
    FROM kandidaten
    ORDER BY medewerker_naam ASC
    LIMIT $1
    `,
    [limit]
  );

  return result.rows;
}

function renderOnboardingMail(
  opdracht: any,
  bevestigUrl: string,
  heeftVragen: boolean
) {
  const titel = opdracht.nummer
    ? `${opdracht.nummer}. ${opdracht.titel}`
    : opdracht.titel;

  const subject = `Onboarding Vincenzo - ${titel}`;

  const introTekst = heeftVragen
    ? "Dit is de volgende stap in je onboarding bij IJssalon Vincenzo. Lees de instructie rustig door. Daarna beantwoord je online een paar controlevragen."
    : "Dit is de volgende stap in je onboarding bij IJssalon Vincenzo. Lees de instructie rustig door. Klik daarna onderaan op de knop om te bevestigen dat je de instructie hebt gelezen en begrepen.";

  const knopTekst = heeftVragen
    ? "Open instructie en vragen"
    : "Ik heb deze instructie gelezen en begrepen";

  const linkLabel = heeftVragen ? "Instructie en vragen" : "Bevestigen";
  const schoneInhoud = schoneInstructieHtml(opdracht.inhoud || "");

  const html = `
    <div style="margin:0; padding:0; background:#f1f5f9; font-family:Arial, sans-serif; color:#0f172a;">
      <div style="max-width:720px; margin:0 auto; padding:24px;">
        <div style="background:#ffffff; border:1px solid #e2e8f0; border-radius:18px; padding:24px;">
          <p style="margin:0 0 12px 0; color:#475569;">Hallo ${
            opdracht.medewerker_naam || ""
          },</p>

          <h1 style="margin:0 0 10px 0; font-size:24px; line-height:1.2;">
            ${titel}
          </h1>

          <p style="margin:0 0 18px 0; color:#475569; line-height:1.5;">
            ${introTekst}
          </p>

          <div style="border-top:1px solid #e2e8f0; border-bottom:1px solid #e2e8f0; padding:18px 0; margin:18px 0; line-height:1.6;">
            ${schoneInhoud}
          </div>

          <p style="margin:20px 0;">
            <a href="${bevestigUrl}"
               style="display:inline-block; background:#2563eb; color:#ffffff; text-decoration:none; padding:12px 18px; border-radius:12px; font-weight:700;">
              ${knopTekst}
            </a>
          </p>

          <p style="margin:18px 0 0 0; color:#64748b; font-size:13px; line-height:1.5;">
            Werkt de knop niet of blijft de pagina laden? Kopieer dan deze link naar Safari, Chrome of Edge:<br />
            <span style="word-break:break-all;">${bevestigUrl}</span>
          </p>
        </div>
      </div>
    </div>
  `;

  const text = [
    `Hallo ${opdracht.medewerker_naam || ""},`,
    "",
    titel,
    "",
    heeftVragen
      ? "Lees de instructie en beantwoord daarna de controlevragen via de link."
      : "Lees de instructie en bevestig daarna dat je deze hebt gelezen en begrepen.",
    "",
    tekstZonderHtml(schoneInhoud),
    "",
    `${linkLabel}: ${bevestigUrl}`,
  ].join("\n");

  return { subject, html, text };
}

export async function haalOnboardingDripStatus() {
  const result = await db.query(`
    SELECT
      status,
      COUNT(*)::int AS aantal
    FROM onboarding_opdrachten
    GROUP BY status
    ORDER BY status
  `);

  return result.rows;
}

export async function verstuurOnboardingDrip({
  origin,
  limit = 5,
  bouwWachtrij = false,
}: {
  origin: string;
  limit?: number;
  bouwWachtrij?: boolean;
}) {
  const wachtrij = bouwWachtrij
    ? await bouwOnboardingWachtrijBij()
    : {
        overgeslagen: true,
        melding: "Wachtrij-opbouw wordt niet tijdens verzenden uitgevoerd.",
      };

  const opdrachten = await haalTeVersturenOpdrachten(limit);

    const verzonden: any[] = [];
    const fouten: any[] = [];

    const veiligeOrigin =
      process.env.APP_URL || origin || "https://werkinstructies-app.vercel.app";

    for (const opdracht of opdrachten) {
      const bevestigUrl = new URL(
        `/onboarding/${opdracht.token}`,
        veiligeOrigin
      ).toString();

    const heeftVragen = await instructieHeeftVragen(opdracht.instructie_id);
    const email = renderOnboardingMail(opdracht, bevestigUrl, heeftVragen);

    try {
      const result = await resend.emails.send({
        from: "IJssalon Vincenzo <noreply@ijssalonvincenzo.nl>",
        to: [opdracht.medewerker_email],
        subject: email.subject,
        html: email.html,
        text: email.text,
      });

      await db.query(
        `
        UPDATE onboarding_opdrachten
        SET
          status = 'verzonden',
          verzonden_op = NOW(),
          token_verloopt_op = NOW() + INTERVAL '30 days',
          laatste_fout = NULL,
          bijgewerkt_op = NOW()
        WHERE id = $1
        `,
        [opdracht.id]
      );

      verzonden.push({
        medewerker_email: opdracht.medewerker_email,
        medewerker_naam: opdracht.medewerker_naam,
        instructie: opdracht.titel,
        heeftVragen,
        result,
      });
    } catch (error) {
      await db.query(
        `
        UPDATE onboarding_opdrachten
        SET
          laatste_fout = $2,
          bijgewerkt_op = NOW()
        WHERE id = $1
        `,
        [opdracht.id, String(error)]
      );

      fouten.push({
        medewerker_email: opdracht.medewerker_email,
        instructie: opdracht.titel,
        error: String(error),
      });
    }
  }

  return {
    wachtrij,
    gevonden: opdrachten.length,
    verzonden,
    fouten,
  };
}