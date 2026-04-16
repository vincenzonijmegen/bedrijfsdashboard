import { NextRequest, NextResponse } from "next/server";
import { renderDagrapportEmail } from "@/lib/mail/renderDagrapportEmail";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const origin = req.nextUrl.origin;

    const res = await fetch(`${origin}/api/rapportage/dagrapport`, {
      cache: "no-store",
    });

    const data = await res.json();

    if (!res.ok || !data?.success) {
      return NextResponse.json(
        {
          error: "Fout bij ophalen dagrapport",
          details: data?.error || "Onbekende fout",
        },
        { status: 500 }
      );
    }

    const { html } = renderDagrapportEmail(data);

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Fout bij test mail",
        details: String(err),
      },
      { status: 500 }
    );
  }
}