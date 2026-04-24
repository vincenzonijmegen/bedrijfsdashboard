import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const token = process.env.CALENDLY_TOKEN;
    const user = process.env.CALENDLY_USER_URI;

    if (!token || !user) {
      return NextResponse.json({ error: "Missing env vars" }, { status: 500 });
    }

    // Afspraken ophalen
    const res = await fetch(
      `https://api.calendly.com/scheduled_events?user=${encodeURIComponent(
        user
      )}&status=active`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: "no-store",
      }
    );

    const data = await res.json();

    for (const event of data.collection || []) {
      // invitees ophalen per event
      const inviteeRes = await fetch(
        `https://api.calendly.com/scheduled_events/${event.uri.split("/").pop()}/invitees`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const inviteeData = await inviteeRes.json();

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
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}