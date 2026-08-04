import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyJWT } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type BackupRij = {
  backup_run_id: string | number;
  snapshot_id: string | number | null;
  status: string;
  periode_van: string;
  periode_tot: string;
  gestart_op: string;
  voltooid_op: string | null;
  aantal_diensten: number | null;
  payload_sha256: string | null;
  shiftbase_opgehaald_op: string | null;
  opgeslagen_op: string | null;
};

async function isBeheerder(req: NextRequest) {
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

    return String(result.rows[0]?.rol || "").toLowerCase() === "beheerder";
  } catch {
    return false;
  }
}

export async function GET(req: NextRequest) {
  if (!(await isBeheerder(req))) {
    return NextResponse.json(
      { success: false, error: "Niet toegestaan" },
      { status: 401 }
    );
  }

  try {
    const overzichtResult = await db.query(
      `
        SELECT
          backup_run_id,
          snapshot_id,
          status,
          periode_van,
          periode_tot,
          gestart_op,
          voltooid_op,
          aantal_diensten,
          payload_sha256,
          shiftbase_opgehaald_op,
          opgeslagen_op
        FROM shiftbase_rooster_backup_overzicht
        ORDER BY gestart_op DESC
        LIMIT 100
      `
    );

    const backups = overzichtResult.rows as BackupRij[];
    const gevraagdeId = req.nextUrl.searchParams.get("backup_run_id");

    const geselecteerdeBackup = gevraagdeId
      ? backups.find((backup) => String(backup.backup_run_id) === gevraagdeId)
      : backups.find(
          (backup) => backup.status === "voltooid" && backup.snapshot_id !== null
        );

    if (!geselecteerdeBackup) {
      return NextResponse.json({
        success: true,
        backups,
        geselecteerdeBackup: null,
        diensten: [],
      });
    }

    if (
      geselecteerdeBackup.status !== "voltooid" ||
      geselecteerdeBackup.snapshot_id === null
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Deze backuprun bevat geen voltooide snapshot.",
          backups,
        },
        { status: 400 }
      );
    }

    const snapshotResult = await db.query(
      `
        SELECT payload
        FROM shiftbase_rooster_snapshots
        WHERE backup_run_id = $1
        LIMIT 1
      `,
      [geselecteerdeBackup.backup_run_id]
    );

    const payload = snapshotResult.rows[0]?.payload;
    const diensten = Array.isArray(payload) ? payload : [];

    return NextResponse.json({
      success: true,
      backups,
      geselecteerdeBackup,
      diensten,
    });
  } catch (error) {
    console.error("Shiftbase-roosterbackups ophalen mislukt:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Roosterbackups konden niet worden opgehaald.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
