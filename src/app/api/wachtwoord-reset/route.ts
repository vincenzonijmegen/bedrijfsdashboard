import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error:
        "Deze wachtwoordreset-route is niet meer in gebruik. Vraag een nieuwe resetlink aan.",
    },
    { status: 410 }
  );
}