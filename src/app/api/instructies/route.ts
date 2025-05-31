import { NextRequest, NextResponse } from "next/server";

let instructies = [
  { id: "1", titel: "Schoonmaak ijsmachine", inhoud: "Spoelen, reinigen, drogen." },
  { id: "2", titel: "Kassa afsluiten", inhoud: "Geld tellen en afsluiten." },
];

export async function GET() {
  return NextResponse.json(instructies);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const nieuwe = {
    id: crypto.randomUUID(),
    titel: body.titel,
    inhoud: body.inhoud,
  };
  instructies.push(nieuwe);
  return NextResponse.json({ status: "ok", instructie: nieuwe });
}
