import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const token = process.env.CALENDLY_TOKEN;
    const user = process.env.CALENDLY_USER_URI;

    if (!token || !user) {
      return NextResponse.json(
        { error: "Missing env vars" },
        { status: 500 }
      );
    }

    // 🔽 1. Haal afspraken op
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
      return NextResponse.json(
        { error: "Calendly fetch failed" },
        { status: 500 }
      );
    }

    const data = await res.json();

    // 🔽 2. Loop door events
    for (const event of data.collection || []) {
      const eventId = event.uri.split("/").pop();

      // 🔽 3. Haal invitees op
      const inviteeRes = await fetch(
        `https://api.calendly.com/scheduled_events/${eventId}/invitees`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!inviteeRes.ok) {
        console.error("Invitee fetch error:", await inviteeRes.text());
        continue;
      }

      const inviteeData = await inviteeRes.json();

      // 🔽 4. Opslaan in DB
      for (const invitee of inviteeData.collection || []) {
        await db.query(
          `
          INSERT INTO sollicitatie_afspraken
          (naam, email, starttijd, eindtijd, status, calendly_uri)
          VALUES ($1, $2, $3, $4, $5, $6)
          ON CONFLICT (calendly_uri) DO NOTHING
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
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("SYNC ERROR:", error);
    return NextResponse.json(
      { error: "Sync failed" },
      { status: 500 }
    );
  }
}