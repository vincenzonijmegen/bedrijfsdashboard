import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";
import {
  getGoogleAccessToken,
  getStoredGoogleConnection,
  googleBusinessConfigured,
  listGoogleBusinessLocations,
} from "@/lib/googleBusiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    verifyJWT(request);

    if (!googleBusinessConfigured()) {
      return NextResponse.json({
        configured: false,
        connected: false,
        selectedLocation: null,
        locations: [],
      });
    }

    const stored = await getStoredGoogleConnection();
    if (!stored?.refresh_token) {
      return NextResponse.json({
        configured: true,
        connected: false,
        selectedLocation: null,
        locations: [],
      });
    }

    const accessToken = await getGoogleAccessToken();
    const locations = await listGoogleBusinessLocations(accessToken);
    const selectedLocation = locations.find(
      (location) =>
        location.accountName === stored.account_name &&
        location.locationName === stored.location_name
    ) || null;

    return NextResponse.json({
      configured: true,
      connected: true,
      selectedLocation,
      locations,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Google Business Profile-status ophalen is mislukt.",
      },
      { status: 500 }
    );
  }
}
