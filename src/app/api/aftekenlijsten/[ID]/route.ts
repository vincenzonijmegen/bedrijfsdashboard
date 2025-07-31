// src/app/api/aftekenlijsten/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_KEY!,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET!,
  },
});

export async function DELETE(request: NextRequest) {
  const urlParts = request.nextUrl.pathname.split("/");
  const id = parseInt(urlParts[urlParts.length - 1]);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Ongeldig ID" }, { status: 400 });
  }

  const result = await db.query("SELECT bestand_url FROM aftekenlijsten WHERE id = $1", [id]);
  const url: string | undefined = result.rows[0]?.bestand_url;

  if (url) {
    const path = url.split(`/${process.env.CLOUDFLARE_R2_BUCKET}/`)[1];
    if (path) {
      await r2.send(new DeleteObjectCommand({
        Bucket: process.env.CLOUDFLARE_R2_BUCKET!,
        Key: path,
      }));
    }
  }

  await db.query("DELETE FROM aftekenlijsten WHERE id = $1", [id]);

  return NextResponse.json({
    status: "verwijderd",
    snackbar: {
      type: "success",
      message: "Aftekenlijst is succesvol verwijderd."
    }
  });
}