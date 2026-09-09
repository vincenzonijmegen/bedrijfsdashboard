import { NextRequest, NextResponse } from "next/server";
import { berekenVincenzoBasis } from "@/lib/cashflow/berekenVincenzoBasis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const huidigJaar = new Date().getFullYear();
    const jaar = Number(url.searchParams.get("jaar") ?? huidigJaar);
    if (!Number.isInteger(jaar)) {
      return NextResponse.json({ success: false, error: "Ongeldig jaar" }, { status: 400 });
    }

    const data = await berekenVincenzoBasis(jaar);
    return NextResponse.json(
      { success: true, fase: "4B", data },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[/api/admin/cashflow/basis] error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
