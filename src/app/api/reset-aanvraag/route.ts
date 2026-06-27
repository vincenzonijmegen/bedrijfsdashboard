import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error:
        "Deze reset-aanvraagroute is niet meer in gebruik. Gebruik /wachtwoord-vergeten.",
    },
    { status: 410 }
  );
}