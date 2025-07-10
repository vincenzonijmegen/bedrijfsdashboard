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

  try {
    // Upload bestand naar Vercel Blob (overschrijven toegestaan)
    const blob = await put(`sollicitaties/${email}.${extension}`, file, {
      access: "public",
      allowOverwrite: true,
    });

    // Verwijder eventueel eerder opgeslagen document
    await db.query("DELETE FROM personeelsdocumenten WHERE email = $1", [email]);

    // Voeg nieuwe document-URL toe
    await db.query(
      `INSERT INTO personeelsdocumenten (email, bestand_url)
       VALUES ($1, $2)`,
      [email, blob.url]
    );

    return NextResponse.json({ success: true, url: blob.url });
  } catch (err) {
    console.error("Fout bij upload:", err);
    return NextResponse.json({ error: "Upload mislukt" }, { status: 500 });
  }
}
