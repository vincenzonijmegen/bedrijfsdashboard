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

  // Sla op in personeelsdocumenten
  await db.query(
    `INSERT INTO personeelsdocumenten (email, bestand_url, type, toegevoegd_op)
     VALUES ($1, $2, $3, NOW())`,
    [email, blob.url, "sollicitatie"]
  );

  return NextResponse.json({ success: true, url: blob.url });
}
