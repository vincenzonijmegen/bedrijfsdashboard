import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ ok: true });

  // cookie verwijderen (zelfde naam als je login gebruikt!)
  res.cookies.set("keuken_auth", "", {
    path: "/",
    expires: new Date(0),
  });

  return res;
}