// src/app/api/dossier/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const email = formData.get("email") as string;

  if (!file || !email) {
    return NextResponse.json({ error: "Bestand of e-mail ontbreekt" }, { status: 400 });
  }

  const extension = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const blob = await put(`sollicitaties/${email}.${extension}`, file, {
    access: "public",
    allowOverwrite: true,
  });

  // Sla op in personeelsdocumenten zonder kolommen type of toegevoegd_op
  await db.query(
    `INSERT INTO personeelsdocumenten (email, bestand_url)
     VALUES ($1, $2)`,
    [email, blob.url]
  );

  return NextResponse.json({ success: true, url: blob.url });
}
