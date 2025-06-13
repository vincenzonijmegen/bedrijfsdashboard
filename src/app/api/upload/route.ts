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

    // Upload naar opslag (bijv. Vercel Blob of Cloudflare R2)
    // Hier voorbeeld met Vercel Blob:
    // import { put } from "@vercel/blob";
    const { put } = await import("@vercel/blob");
    const uploadRes = await put(filename, buffer, { access: "public" });

    return NextResponse.json({ url: uploadRes.url });
  } catch (err) {
    console.error("❌ Fout bij upload:", err);
    return NextResponse.json({ error: "Upload mislukt", details: String(err) }, { status: 500 });
  }
}
