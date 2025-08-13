// src/app/api/aftekenlijsten/[id]/route.ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_KEY as string,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET as string,
  },
});

function extractKeyFromUrl(url: string, bucket: string): string | null {
  try {
    const u = new URL(url);
    let p = u.pathname.replace(/^\/+/, "");
    const prefix = `${bucket}/`;
    if (p.startsWith(prefix)) p = p.slice(prefix.length);
    return p || null;
  } catch {
    return null;
  }
}

export async function DELETE(req: Request) {
  // Geen tweede param meer gebruiken -> id veilig uit de URL halen
  const url = new URL(req.url);
  // path = /api/aftekenlijsten/123  -> pak laatste segment
  const segs = url.pathname.split("/").filter(Boolean);
  const idStr = segs[segs.length - 1];
  const idNum = Number(idStr);

  if (!Number.isFinite(idNum)) {
    return NextResponse.json({ error: "Ongeldig ID" }, { status: 400 });
  }

  try {
    // record ophalen
    const rec = await db.query(
      `SELECT bestand_url FROM aftekenlijsten WHERE id = $1`,
      [idNum]
    );
    if (rec.rowCount === 0) {
      return NextResponse.json({ error: "Niet gevonden" }, { status: 404 });
    }

    const bestandUrl: string | null = rec.rows[0]?.bestand_url ?? null;

    // R2 object verwijderen (best-effort)
    if (bestandUrl) {
      const bucket = process.env.CLOUDFLARE_R2_BUCKET as string;
      const key = bucket ? extractKeyFromUrl(bestandUrl, bucket) : null;
      if (bucket && key) {
        try {
          await r2.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
        } catch (e) {
          console.error("[R2 delete] mislukt:", e);
        }
      }
    }

    // DB record verwijderen
    await db.query(`DELETE FROM aftekenlijsten WHERE id = $1`, [idNum]);

    return NextResponse.json({
      status: "verwijderd",
      snackbar: { type: "success", message: "Aftekenlijst is succesvol verwijderd." },
    });
  } catch (e) {
    console.error("[aftekenlijsten DELETE] fout:", e);
    return NextResponse.json({ error: "Interne serverfout" }, { status: 500 });
  }
}
