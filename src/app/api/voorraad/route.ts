// src/app/api/voorraad/artikelen/route.ts
import { NextResponse } from "next/server";

// Dummydata voor nu (later uit Railway PostgreSQL)
const artikelen = [
  {
    id: "A1",
    naam: "Chocolade",
    leverancier: "Profi Gelato",
    bestelnummer: "CH-001",
    eenheid: "kg",
    prijs: 3.5,
    minVoorraad: 5,
  },
  {
    id: "A2",
    naam: "Vanille",
    leverancier: "Profi Gelato",
    bestelnummer: "VA-002",
    eenheid: "kg",
    prijs: 3.0,
    minVoorraad: 4,
  },
  {
    id: "A3",
    naam: "Aardbei",
    leverancier: "Hanos",
    bestelnummer: "AA-003",
    eenheid: "kg",
    prijs: 2.8,
    minVoorraad: 6,
  },
];

export async function GET() {
  return NextResponse.json(artikelen);
}
