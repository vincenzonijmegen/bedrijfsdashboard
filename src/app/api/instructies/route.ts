import { NextResponse } from "next/server";

const instructies = [
  {
    id: "1",
    titel: "Schoonmaak ijsmachine",
    versie: 1,
  },
  {
    id: "2",
    titel: "Kassa afsluiten",
    versie: 1,
  },
  {
    id: "3",
    titel: "Werkkleding en hygiëne",
    versie: 1,
  },
];

export async function GET() {
  return NextResponse.json(instructies);
}
