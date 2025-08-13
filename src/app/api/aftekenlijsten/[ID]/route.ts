// src/app/api/aftekenlijsten/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";

// Cloudflare R2 S3-compatible client
const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  forcePathStyle: true, // R2: gebruik path-style addressing
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_KEY as string,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET as string,
  },
});

/**
 * Haal een S3 key uit een (publieke) URL.
 * Werkt voor:
 *   - https://<account>.r2.cloudflarestorage.com/<bucket>/<key...>
 *   - https://<custom-domain>/<optional-bucket>/<key...>
 *   - https://<r2.dev>/<bucket>/<key...>
 */
function extractKeyFromUrl(url: string, bucket: string): string | null {
  try {
    const u = new URL(url);
    // Normaliseer pad -> zonder leading slash
    let p = u.pathname.replace(/^\/+/, ""); // bv. "<bucket>/folder/file.pdf" of "folder/file.pdf"
    if (!p) return null;

    // Als het pad met <bucket>/ begint, strip dat:
    const bucketPrefix = `${bucket}/`;
    if (p.startsWith(bucketPrefix)) {
      p = p.slice(bucketPrefix.length);
    }
    return p.length ? p : null;
  } catch {
    return null;
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const idNum = Number(params.id);
  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ error: "Ongeldig ID" }, { status: 400 });
  }

  try {
    // 1) Bestaat het record?
    const rec = await db.query(
      `SELECT bestand_url FROM aftekenlijsten WHERE id = $1`,
      [idNum]
    );

    if (rec.rowCount === 0) {
      return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
    }

    const bestandUrl: string | null = rec.rows[0]?.bestand_url ?? null;

    // 2) Probeer object in R2 te verwijderen (best-effort)
    if (bestandUrl) {
      const bucket = process.env.CLOUDFLARE_R2_BUCKET as string;
      if (!bucket) {
        console.warn("[aftekenlijsten DELETE] CLOUDFLARE_R2_BUCKET ontbreekt; sla object-delete over");
      } else {
        const key = extractKeyFromUrl(bestandUrl, bucket);
        if (key) {
          try {
            await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
          } catch (e) {
            // Niet fatally; we loggen en gaan door met DB delete
            console.error("[aftekenlijsten DELETE] R2 delete faalde:", e);
          }
        } else {
          console.warn("[aftekenlijsten DELETE] Kon key niet extraheren uit URL:", bestandUrl);
        }
      }
    }

    // 3) Verwijder DB record
    await db.query(`DELETE FROM aftekenlijsten WHERE id = $1`, [idNum]);

    return NextResponse.json({
      status: "verwijderd",
      snackbar: {
        type: "success",
        message: "Aftekenlijst is succesvol verwijderd.",
      },
    });
  } catch (e) {
    console.error("[aftekenlijsten DELETE] fout:", e);
    return NextResponse.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
