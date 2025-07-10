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
  const emailNorm = email.trim().toLowerCase();
  const bestandsnaam = `sollicitaties/${emailNorm}-${Date.now()}.${extension}`;

  try {
    const blob = await put(bestandsnaam, file, {
      access: "public"
    });

    await db.query(
      `INSERT INTO personeelsdocumenten (email, bestand_url)
       VALUES ($1, $2)
       ON CONFLICT (email) DO UPDATE SET bestand_url = EXCLUDED.bestand_url`,
      [emailNorm, blob.url]
    );

    return NextResponse.json({ success: true, url: blob.url });
  } catch (err) {
    console.error("Fout bij upload:", err);
    return NextResponse.json({ error: "Upload mislukt" }, { status: 500 });
  }
}
