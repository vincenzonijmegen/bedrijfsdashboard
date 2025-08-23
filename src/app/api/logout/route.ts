import { NextResponse } from "next/server";

export async function POST() {
  const res = new NextResponse(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
    },
  });

  res.cookies.set("sessie_token", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0, // onmiddellijke verwijdering
  });

  return res;
}
