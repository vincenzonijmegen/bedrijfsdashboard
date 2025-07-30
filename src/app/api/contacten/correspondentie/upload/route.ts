// src/app/api/contacten/correspondentie/upload/route.ts

import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;
  const contactId = formData.get("contact_id") as string;

  if (!file || !contactId) {
    return NextResponse.json({ error: "Bestand of contact_id ontbreekt" }, { status: 400 });
  }

  // Bepaal extensie en blob-path
  const extension = file.name.split(".").pop()?.toLowerCase() || "pdf";
  const key = `contacten/${contactId}/${Date.now()}.${extension}`;

  try {
    // Upload naar Vercel Blob met publieke toegang
    const blob = await put(key, file, { access: "public" });

    // Sla URL en contactId op in database
    await db.query(
      `INSERT INTO contact_pdfs (contact_id, bestand_url)
       VALUES ($1, $2)
       ON CONFLICT (contact_id) DO UPDATE SET bestand_url = EXCLUDED.bestand_url`,
      [contactId, blob.url]
    );

    return NextResponse.json({ success: true, url: blob.url });
  } catch (err) {
    console.error("Fout bij upload Van contact-pdf:", err);
    return NextResponse.json({ error: "Upload mislukt" }, { status: 500 });
  }
}
