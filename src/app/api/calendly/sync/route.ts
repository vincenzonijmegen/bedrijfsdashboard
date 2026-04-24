import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function syncCalendly() {
  const token = process.env.CALENDLY_TOKEN;
  const user = process.env.CALENDLY_USER_URI;

  if (!token || !user) {
  return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
}

await db.query(`
  DELETE FROM sollicitatie_afspraken
  WHERE starttijd >= CURRENT_DATE
`);

const minStartTime = new Date().toISOString();

  const res = await fetch(
    `https://api.calendly.com/scheduled_events?user=${encodeURIComponent(
      user
    )}&status=active&min_start_time=${encodeURIComponent(
      minStartTime
    )}&sort=start_time:asc&count=100`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    }
  );

  if (!res.ok) {
    console.error("Calendly fetch error:", await res.text());
    return NextResponse.json({ error: "Calendly fetch failed" }, { status: 500 });
  }

  const data = await res.json();

  let insertedOrSkipped = 0;

  for (const event of data.collection || []) {
    const eventId = event.uri.split("/").pop();

    const inviteeRes = await fetch(
      `https://api.calendly.com/scheduled_events/${eventId}/invitees`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    if (!inviteeRes.ok) {
      console.error("Invitee fetch error:", await inviteeRes.text());
      continue;
    }

    const inviteeData = await inviteeRes.json();

    for (const invitee of inviteeData.collection || []) {
      await db.query(
        `
        INSERT INTO sollicitatie_afspraken
        (naam, email, starttijd, eindtijd, status, calendly_uri)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (calendly_uri) DO UPDATE SET
          naam = EXCLUDED.naam,
          email = EXCLUDED.email,
          starttijd = EXCLUDED.starttijd,
          eindtijd = EXCLUDED.eindtijd,
          status = EXCLUDED.status
        `,
        [
          invitee.name,
          invitee.email,
          event.start_time,
          event.end_time,
          event.status,
          invitee.uri,
        ]
      );

      insertedOrSkipped += 1;
    }
  }

  return NextResponse.json({
    success: true,
    synced: insertedOrSkipped,
  });
}

export async function POST() {
  return syncCalendly();
}

export async function GET() {
  return syncCalendly();
}