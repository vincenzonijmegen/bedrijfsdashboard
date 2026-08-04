// ===========================
// File: src/app/api/shiftbase/rooster-backup/route.ts
// ===========================
import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyJWT } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAG_MS = 24 * 60 * 60 * 1000;
const MAXIMALE_PERIODE_DAGEN = 370;

type BackupRun = {
  id: string | number;
};

function formatDatumUTC(datum: Date) {
  return datum.toISOString().slice(0, 10);
}

function standaardPeriode() {
  const vandaag = new Date();
  const van = new Date(
    Date.UTC(
      vandaag.getUTCFullYear(),
      vandaag.getUTCMonth(),
      vandaag.getUTCDate()
    )
  );
  const tot = new Date(van.getTime() + 365 * DAG_MS);

  return {
    minDate: formatDatumUTC(van),
    maxDate: formatDatumUTC(tot),
  };
}

function isGeldigeDatum(waarde: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(waarde)) return false;

  const datum = new Date(`${waarde}T00:00:00.000Z`);
  return !Number.isNaN(datum.getTime()) && formatDatumUTC(datum) === waarde;
}

function controleerPeriode(minDate: string, maxDate: string) {
  if (!isGeldigeDatum(minDate) || !isGeldigeDatum(maxDate)) {
    return "Gebruik voor min_date en max_date het formaat YYYY-MM-DD.";
  }

  const van = new Date(`${minDate}T00:00:00.000Z`);
  const tot = new Date(`${maxDate}T00:00:00.000Z`);
  const verschilDagen = Math.floor((tot.getTime() - van.getTime()) / DAG_MS);

  if (verschilDagen < 0) {
    return "max_date mag niet vóór min_date liggen.";
  }

  if (verschilDagen > MAXIMALE_PERIODE_DAGEN) {
    return `De backupperiode mag maximaal ${MAXIMALE_PERIODE_DAGEN} dagen zijn.`;
  }

  return null;
}

async function isToegestaan(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = req.headers.get("authorization");

  if (cronSecret && authorization === `Bearer ${cronSecret}`) {
    return true;
  }

  try {
    const gebruiker = verifyJWT(req);
    const result = await db.query(
      `
        SELECT rol
        FROM medewerkers
        WHERE LOWER(email) = LOWER($1)
        LIMIT 1
      `,
      [gebruiker.email]
    );

    return result.rows[0]?.rol === "beheerder";
  } catch {
    return false;
  }
}

async function maakRoosterBackup(req: NextRequest) {
  if (!(await isToegestaan(req))) {
    return NextResponse.json(
      { success: false, error: "Niet toegestaan" },
      { status: 401 }
    );
  }

  const standaard = standaardPeriode();
  const minDate = req.nextUrl.searchParams.get("min_date") || standaard.minDate;
  const maxDate = req.nextUrl.searchParams.get("max_date") || standaard.maxDate;
  const periodeFout = controleerPeriode(minDate, maxDate);

  if (periodeFout) {
    return NextResponse.json(
      { success: false, error: periodeFout },
      { status: 400 }
    );
  }

  const apiKey = process.env.SHIFTBASE_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { success: false, error: "SHIFTBASE_API_KEY ontbreekt" },
      { status: 500 }
    );
  }

  let backupRunId: string | number | null = null;

  try {
    const runResult = await db.query(
      `
        INSERT INTO shiftbase_rooster_backup_runs (
          status,
          periode_van,
          periode_tot,
          aangemaakt_door
        )
        VALUES ('gestart', $1, $2, 'api-rooster-backup')
        RETURNING id
      `,
      [minDate, maxDate]
    );

    const run = runResult.rows[0] as BackupRun | undefined;

    if (!run?.id) {
      throw new Error("Backuprun kon niet worden aangemaakt.");
    }

    backupRunId = run.id;

    const shiftbaseUrl = new URL("https://api.shiftbase.com/api/rosters");
    shiftbaseUrl.searchParams.set("min_date", minDate);
    shiftbaseUrl.searchParams.set("max_date", maxDate);

    const opgehaaldOp = new Date();
    const shiftbaseResponse = await fetch(shiftbaseUrl.toString(), {
      headers: {
        Authorization: `API ${apiKey}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    const responseTekst = await shiftbaseResponse.text();

    if (!shiftbaseResponse.ok) {
      throw new Error(
        `Shiftbase gaf status ${shiftbaseResponse.status}: ${responseTekst.slice(
          0,
          1000
        )}`
      );
    }

    let roosterData: unknown;

    try {
      const parsed = JSON.parse(responseTekst);
      roosterData = Array.isArray(parsed) ? parsed : parsed?.data;
    } catch {
      throw new Error("Shiftbase retourneerde ongeldige JSON.");
    }

    if (!Array.isArray(roosterData)) {
      throw new Error("Shiftbase retourneerde geen roosterarray.");
    }

    const payloadJson = JSON.stringify(roosterData);
    const payloadSha256 = createHash("sha256")
      .update(payloadJson, "utf8")
      .digest("hex");

    const client = await db.getClient();

    try {
      await client.query("BEGIN");

      await client.query(
        `
          INSERT INTO shiftbase_rooster_snapshots (
            backup_run_id,
            periode_van,
            periode_tot,
            aantal_diensten,
            payload,
            payload_sha256,
            shiftbase_opgehaald_op
          )
          VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
        `,
        [
          backupRunId,
          minDate,
          maxDate,
          roosterData.length,
          payloadJson,
          payloadSha256,
          opgehaaldOp.toISOString(),
        ]
      );

      await client.query(
        `
          UPDATE shiftbase_rooster_backup_runs
          SET
            status = 'voltooid',
            voltooid_op = NOW(),
            aantal_diensten = $2,
            foutmelding = NULL
          WHERE id = $1
        `,
        [backupRunId, roosterData.length]
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }

    return NextResponse.json({
      success: true,
      backupRunId,
      periodeVan: minDate,
      periodeTot: maxDate,
      aantalDiensten: roosterData.length,
      payloadSha256,
      shiftbaseOpgehaaldOp: opgehaaldOp.toISOString(),
    });
  } catch (error) {
    const foutmelding =
      error instanceof Error ? error.message : String(error || "Onbekende fout");

    if (backupRunId !== null) {
      try {
        await db.query(
          `
            UPDATE shiftbase_rooster_backup_runs
            SET
              status = 'mislukt',
              voltooid_op = NOW(),
              aantal_diensten = NULL,
              foutmelding = $2
            WHERE id = $1
          `,
          [backupRunId, foutmelding.slice(0, 5000)]
        );
      } catch (registratieFout) {
        console.error(
          "Shiftbase-backupfout kon niet worden geregistreerd:",
          registratieFout
        );
      }
    }

    console.error("Shiftbase-roosterbackup mislukt:", error);

    return NextResponse.json(
      {
        success: false,
        backupRunId,
        error: "Shiftbase-roosterbackup mislukt",
        details: foutmelding,
      },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  return maakRoosterBackup(req);
}

// Nodig voor een latere Vercel-cron. Dezelfde beveiliging en logica als POST.
export async function GET(req: NextRequest) {
  return maakRoosterBackup(req);
}