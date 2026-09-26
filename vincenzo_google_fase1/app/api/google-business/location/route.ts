import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";
import {
  getGoogleAccessToken,
  listGoogleBusinessLocations,
  saveSelectedGoogleLocation,
} from "@/lib/googleBusiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    verifyJWT(request);
    const body = (await request.json()) as {
      accountName?: string;
      locationName?: string;
    };

    if (!body.accountName || !body.locationName) {
      return NextResponse.json(
        { error: "Geen Google-locatie gekozen." },
        { status: 400 }
      );
    }

    const accessToken = await getGoogleAccessToken();
    const locations = await listGoogleBusinessLocations(accessToken);
    const exists = locations.some(
      (location) =>
        location.accountName === body.accountName &&
        location.locationName === body.locationName
    );

    if (!exists) {
      return NextResponse.json(
        { error: "De gekozen Google-locatie is niet beschikbaar voor dit account." },
        { status: 400 }
      );
    }

    await saveSelectedGoogleLocation(body.accountName, body.locationName);
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Google-locatie opslaan is mislukt.",
      },
      { status: 500 }
    );
  }
}
