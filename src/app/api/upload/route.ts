console.log("🛰️ Upload API aangeroepen");

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "Geen bestand ontvangen" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const filename = `${Date.now()}-${file.name.replace(/\s+/g, "_")}`;
console.log("📦 Bestand ontvangen:", filename);
console.log("🔑 Token aanwezig:", !!process.env.VERCEL_BLOB_READ_WRITE_TOKEN);

    // Upload naar opslag (bijv. Vercel Blob of Cloudflare R2)
    // Hier voorbeeld met Vercel Blob:
    // import { put } from "@vercel/blob";
    const { put } = await import("@vercel/blob");
    const uploadRes = await put(filename, buffer, {
  access: "public",
  token: process.env.VERCEL_BLOB_READ_WRITE_TOKEN!,
});


    return NextResponse.json({ url: uploadRes.url });
  } catch (err) {
  console.error("❌ Upload fout:", err);
  return new NextResponse(
    JSON.stringify({ error: "Upload mislukt", details: String(err) }),
    { status: 500, headers: { "Content-Type": "application/json" } }
  );
}
