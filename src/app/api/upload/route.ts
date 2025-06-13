import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob"; // of je eigen R2-client

export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File;

  if (!file) {
    return NextResponse.json({ error: "Geen bestand ontvangen" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const filename = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;

  // ✨ Upload naar Cloudflare R2 / Vercel Blob / andere storage
  const uploadRes = await put(filename, buffer, {
    access: "public",
  });

  return NextResponse.json({ url: uploadRes.url });
}
