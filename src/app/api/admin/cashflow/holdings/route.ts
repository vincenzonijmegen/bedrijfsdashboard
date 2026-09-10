import { NextRequest, NextResponse } from "next/server";
import { berekenHoldingsMeerjaren } from "@/lib/cashflow/berekenHoldingsMeerjaren";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const currentYear = new Date().getFullYear();
    const url = new URL(req.url);
    const toYear = Number(url.searchParams.get("tot") || currentYear + 3);
    const data = await berekenHoldingsMeerjaren(toYear);
    return NextResponse.json({ success: true, fase: "4G", data });
  } catch (error) {
    return NextResponse.json({ success: false, fase: "4G", error: String(error) }, { status: 500 });
  }
}
