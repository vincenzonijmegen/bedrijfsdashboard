import { NextRequest, NextResponse } from "next/server";

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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const password = String(body?.password || "");

    if (!password) {
      return NextResponse.json(
        { success: false, error: "Wachtwoord ontbreekt" },
        { status: 400 }
      );
    }

    if (password !== process.env.KEUKEN_PASSWORD) {
      return NextResponse.json(
        { success: false, error: "Onjuist wachtwoord" },
        { status: 401 }
      );
    }

    const value = "ok";
    const signature = await sign(value);
    const token = `${value}.${signature}`;

    const res = NextResponse.json({ success: true });

    res.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return res;
  } catch (error) {
    console.error("Keuken login fout:", error);
    return NextResponse.json(
      { success: false, error: "Inloggen mislukt" },
      { status: 500 }
    );
  }
}