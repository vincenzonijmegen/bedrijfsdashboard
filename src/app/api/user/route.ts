import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    naam: "Herman",
    email: "herman@ijssalonvincenzo.nl",
  });
}
