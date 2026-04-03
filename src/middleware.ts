import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const COOKIE_NAME = "keuken_auth";

async function sign(value: string) {
  const secret = process.env.KEUKEN_COOKIE_SECRET || "fallback-secret";

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign(
    "HMAC",
    key,
    enc.encode(value)
  );

  const bytes = Array.from(new Uint8Array(signatureBuffer));
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function isValidKitchenCookie(token?: string) {
  if (!token) return false;

  const [value, signature] = token.split(".");
  if (!value || !signature) return false;

  const expected = await sign(value);
  return value === "ok" && signature === expected;
}

export default clerkMiddleware(async (_auth, req: NextRequest) => {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/keuken")) {
    return NextResponse.next();
  }

  if (pathname === "/keuken/login") {
    return NextResponse.next();
  }

  const token = req.cookies.get(COOKIE_NAME)?.value;

  if (!(await isValidKitchenCookie(token))) {
    const loginUrl = new URL("/keuken/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|sign-in|sign-up|sign-in/.*|sign-up/.*|_next/static|_next/image|favicon.ico).*)",
  ],
};