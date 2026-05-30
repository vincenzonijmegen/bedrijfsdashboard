// src/lib/mail/getManagementMailInstellingen.ts

import { db } from "@/lib/db";

export type ManagementMailSoortSleutel =
  | "dagbriefing"
  | "dagrapport"
  | "weekrapport";

export type ManagementMailSoort = {
  sleutel: ManagementMailSoortSleutel;
  naam: string;
  actief: boolean;
  alleen_versturen_bij_rooster: boolean;
};

export type ManagementMailOntvanger = {
  id: number;
  naam: string | null;
  email: string;
  actief: boolean;
};

export async function getManagementMailInstellingen(
  sleutel: ManagementMailSoortSleutel
) {
  const soortResult = await db.query(
    `
    SELECT
      sleutel,
      naam,
      actief,
      alleen_versturen_bij_rooster
    FROM management_mail_soorten
    WHERE sleutel = $1
    LIMIT 1
    `,
    [sleutel]
  );

  const soort = soortResult.rows[0] as ManagementMailSoort | undefined;

  if (!soort) {
    throw new Error(`Mailsoort '${sleutel}' bestaat niet.`);
  }

  const ontvangersResult = await db.query(
    `
    SELECT
      id,
      naam,
      email,
      actief
    FROM management_mail_ontvangers
    WHERE mail_soort_sleutel = $1
      AND actief = true
    ORDER BY naam ASC NULLS LAST, email ASC
    `,
    [sleutel]
  );

  return {
    soort,
    ontvangers: ontvangersResult.rows as ManagementMailOntvanger[],
    ontvangerEmails: ontvangersResult.rows.map((row) => row.email as string),
  };
}