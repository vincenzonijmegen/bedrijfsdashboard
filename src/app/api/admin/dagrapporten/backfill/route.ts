import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dateRange(start: string, end: string) {
  const dates: string[] = [];
  const current = new Date(`${start}T00:00:00`);
  const last = new Date(`${end}T00:00:00`);

  while (current <= last) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (!start || !end) {
      return NextResponse.json(
        { success: false, error: "Gebruik ?start=YYYY-MM-DD&end=YYYY-MM-DD" },
        { status: 400 }
      );
    }

    const baseUrl = req.nextUrl.origin;
    const datums = dateRange(start, end);

    const resultaten: {
      datum: string;
      success: boolean;
      error?: string;
    }[] = [];

    for (const datum of datums) {
      try {
        const res = await fetch(
          `${baseUrl}/api/rapportage/dagrapport?datum=${datum}`,
          { cache: "no-store" }
        );

        const json = await res.json();

        resultaten.push({
          datum,
          success: Boolean(json.success),
          error: json.success ? undefined : json.error || "Onbekende fout",
        });
      } catch (error) {
        resultaten.push({
          datum,
          success: false,
          error: String(error),
        });
      }
    }

    return NextResponse.json({
      success: true,
      start,
      end,
      aantal: resultaten.length,
      gelukt: resultaten.filter((r) => r.success).length,
      mislukt: resultaten.filter((r) => !r.success).length,
      resultaten,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: "Fout bij backfill dagrapporten",
        details: String(error),
      },
      { status: 500 }
    );
  }
}