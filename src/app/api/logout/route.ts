import { NextResponse } from "next/server";

export async function POST() {
  const res = new NextResponse(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });

  res.cookies.set("v_app", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0, // directe verwijdering
  });

  return res;
}
