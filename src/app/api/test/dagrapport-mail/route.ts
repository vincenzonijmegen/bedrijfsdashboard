import { NextResponse } from "next/server";
import { renderDagrapportEmail } from "@/lib/mail/renderDagrapportEmail";

export async function GET() {
  try {
    const res = await fetch(
      "http://localhost:3000/api/rapportage/dagrapport",
      { cache: "no-store" }
    );

    const data = await res.json();

    const { html } = renderDagrapportEmail(data);

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html",
      },
    });
  } catch (err) {
    return NextResponse.json({
      error: "Fout bij test mail",
      details: String(err),
    });
  }
}