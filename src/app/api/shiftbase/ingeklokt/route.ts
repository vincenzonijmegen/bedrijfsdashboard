import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RosterRow = {
  Roster: {
    user_id: string | number;
  };
  User?: {
    id?: string | number;
    name?: string;
  };
};

type ClockRow = {
  Timesheet: {
    user_id: string | number;
    clocked_in?: string | null;
    clocked_out?: string | null;
  };
};

type TimesheetRow = {
  Timesheet: {
    user_id: string | number;
    clocked_in?: string | null;
    clocked_out?: string | null;
  };
};

function ymdLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export async function GET(request: Request) {
  try {
    const vandaag = ymdLocal(new Date());

    const { origin } = new URL(request.url);

    const [roosterRes, clockRes, timesheetsRes] = await Promise.all([
      fetch(`${origin}/api/shiftbase/rooster?datum=${vandaag}`, { cache: "no-store" }),
      fetch(`${origin}/api/shiftbase/clock?date=${vandaag}`, { cache: "no-store" }),
      fetch(`${origin}/api/shiftbase/timesheets?date=${vandaag}`, { cache: "no-store" }),
    ]);

    if (!roosterRes.ok) {
      const details = await roosterRes.text();
      return NextResponse.json({ error: "Rooster ophalen mislukt", details }, { status: 500 });
    }

    const rooster: RosterRow[] = await roosterRes.json();
    const clockJson: { data?: ClockRow[] } = clockRes.ok ? await clockRes.json() : { data: [] };
    const timesheetsJson: { data?: TimesheetRow[] } = timesheetsRes.ok
      ? await timesheetsRes.json()
      : { data: [] };

    const aanwezigeIds = new Set<string>();

    for (const row of clockJson.data ?? []) {
      const ts = row.Timesheet;
      if (ts?.clocked_in && !ts?.clocked_out) {
        aanwezigeIds.add(String(ts.user_id));
      }
    }

    for (const row of timesheetsJson.data ?? []) {
      const ts = row.Timesheet;
      if (ts?.clocked_in && !ts?.clocked_out) {
        aanwezigeIds.add(String(ts.user_id));
      }
    }

    const medewerkers = rooster
      .map((row) => ({
        id: String(row.User?.id ?? row.Roster.user_id),
        name: row.User?.name ?? "Onbekend",
      }))
      .filter((m) => aanwezigeIds.has(m.id));

    const uniek = Array.from(new Map(medewerkers.map((m) => [m.id, m])).values());

    return NextResponse.json(uniek);
  } catch (error) {
    return NextResponse.json(
      { error: "Interne fout bij ophalen ingeklokte medewerkers", details: String(error) },
      { status: 500 }
    );
  }
}