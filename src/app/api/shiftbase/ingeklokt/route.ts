import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ShiftbaseTimesheetRow = {
  id?: string | number;
  employee_id?: string | number;
  user_id?: string | number;
  employee?: {
    id?: string | number;
    name?: string;
    first_name?: string;
    last_name?: string;
  };
  name?: string;
  clock_in?: string | null;
  clock_out?: string | null;
  end?: string | null;
  ended_at?: string | null;
  date?: string;
  start_date?: string;
};

function normaliseerNaam(item: ShiftbaseTimesheetRow) {
  return (
    item.employee?.name ||
    [item.employee?.first_name, item.employee?.last_name].filter(Boolean).join(" ") ||
    item.name ||
    "Onbekend"
  );
}

function normaliseerId(item: ShiftbaseTimesheetRow) {
  return String(item.employee_id || item.user_id || item.employee?.id || item.id || "");
}

export async function GET() {
  const apiKey = process.env.SHIFTBASE_API_KEY?.trim();

  if (!apiKey) {
    return NextResponse.json({ error: "SHIFTBASE_API_KEY ontbreekt" }, { status: 500 });
  }

  const vandaag = new Date().toISOString().slice(0, 10);
  const url = new URL("https://api.shiftbase.com/api/timesheets");
  url.searchParams.set("date", vandaag);

  try {
    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `API ${apiKey}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!res.ok) {
      const details = await res.text();
      return NextResponse.json({ error: "Shiftbase fout", details }, { status: res.status });
    }

    const json = await res.json();
    const rows: ShiftbaseTimesheetRow[] = Array.isArray(json?.data) ? json.data : Array.isArray(json) ? json : [];

    const ingeklokt = rows
      .filter((item) => Boolean(item.clock_in) && !item.clock_out && !item.end && !item.ended_at)
      .map((item) => ({
        id: normaliseerId(item),
        naam: normaliseerNaam(item),
        clock_in: item.clock_in,
      }))
      .filter((item) => item.id && item.naam);

    const uniek = Array.from(new Map(ingeklokt.map((item) => [item.id, item])).values());

    return NextResponse.json({ data: uniek, datum: vandaag });
  } catch (error) {
    return NextResponse.json(
      { error: "Interne fout bij ophalen ingeklokte medewerkers", details: String(error) },
      { status: 500 }
    );
  }
}
