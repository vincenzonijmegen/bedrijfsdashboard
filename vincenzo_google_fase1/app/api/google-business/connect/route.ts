import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { verifyJWT } from "@/lib/auth";
import { buildGoogleAuthorizationUrl } from "@/lib/googleBusiness";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    verifyJWT(request);

    const redirectUri = new URL(
      "/api/google-business/callback",
      request.nextUrl.origin
    ).toString();
    const state = randomUUID();
    const authorizationUrl = buildGoogleAuthorizationUrl(redirectUri, state);

    const response = NextResponse.redirect(authorizationUrl);
    response.cookies.set("google_business_oauth_state", state, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 10 * 60,
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Google koppelen mislukt.";
    return NextResponse.redirect(
      new URL(`/admin/website?google_error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
