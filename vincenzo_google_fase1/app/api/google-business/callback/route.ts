import { NextRequest, NextResponse } from "next/server";
import {
  exchangeAuthorizationCode,
  getGoogleAccessToken,
  listGoogleBusinessLocations,
  saveGoogleTokens,
  saveSelectedGoogleLocation,
} from "@/lib/googleBusiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function normalize(value: string) {
  return value.toLocaleLowerCase("nl-NL").replace(/[^a-z0-9]+/g, " ").trim();
}

export async function GET(request: NextRequest) {
  const base = new URL("/admin/website", request.nextUrl.origin);

  try {
    const returnedState = request.nextUrl.searchParams.get("state") || "";
    const expectedState = request.cookies.get("google_business_oauth_state")?.value || "";
    const code = request.nextUrl.searchParams.get("code");
    const oauthError = request.nextUrl.searchParams.get("error");

    if (oauthError) throw new Error(`Google OAuth: ${oauthError}`);
    if (!code) throw new Error("Google gaf geen autorisatiecode terug.");
    if (!returnedState || !expectedState || returnedState !== expectedState) {
      throw new Error("Google-koppeling afgebroken: ongeldige OAuth state.");
    }

    const redirectUri = new URL(
      "/api/google-business/callback",
      request.nextUrl.origin
    ).toString();

    const tokens = await exchangeAuthorizationCode(code, redirectUri);
    await saveGoogleTokens(tokens);

    const accessToken = await getGoogleAccessToken();
    const locations = await listGoogleBusinessLocations(accessToken);

    if (locations.length === 1) {
      await saveSelectedGoogleLocation(
        locations[0].accountName,
        locations[0].locationName
      );
    } else if (locations.length > 1) {
      const exact = locations.find(
        (location) => normalize(location.title) === "ijssalon vincenzo"
      );
      const contains = locations.find((location) =>
        normalize(location.title).includes("vincenzo")
      );
      const chosen = exact || contains;
      if (chosen) {
        await saveSelectedGoogleLocation(chosen.accountName, chosen.locationName);
      }
    }

    base.searchParams.set("google", "connected");
  } catch (error) {
    base.searchParams.set(
      "google_error",
      error instanceof Error ? error.message : "Google koppelen is mislukt."
    );
  }

  const response = NextResponse.redirect(base);
  response.cookies.set("google_business_oauth_state", "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
