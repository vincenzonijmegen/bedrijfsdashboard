import { NextRequest, NextResponse } from "next/server";
import { berekenVincenzoMeerjaren } from "@/lib/cashflow/berekenVincenzoMeerjaren";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const huidigJaar = new Date().getFullYear();
    const totJaar = Number(url.searchParams.get("tot") ?? huidigJaar + 3);
    if (!Number.isInteger(totJaar)) {
      return NextResponse.json({ success: false, error: "Ongeldig eindjaar" }, { status: 400 });
    }

    const data = await berekenVincenzoMeerjaren(totJaar);
    return NextResponse.json(
      { success: true, fase: "4F", data },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[/api/admin/cashflow/meerjaren] error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
