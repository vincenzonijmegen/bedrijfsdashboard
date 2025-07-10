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

  const blob = await put(`sollicitaties/${email}.pdf`, file, {
    access: "public",
  });

  await db.query(
    `UPDATE medewerkers SET sollicitatie_pdf = $1 WHERE email = $2`,
    [blob.url, email]
  );

  return NextResponse.json({ success: true });
}
