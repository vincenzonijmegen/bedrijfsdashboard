import { NextRequest, NextResponse } from "next/server";
import { berekenHoldingsMeerjaren } from "@/lib/cashflow/berekenHoldingsMeerjaren";

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

const ENTITEITEN = {
  rekka: "Rekka Holding B.V.",
  "eetje-pans": "Eetje Pans Holding B.V.",
} as const;

type EntiteitKey = keyof typeof ENTITEITEN;

type Regel = {
  volgorde: number;
  jaar: number;
  maand: number;
  datumLabel: string;
  omschrijving: string;
  categorie: string;
  in: number;
  uit: number;
  saldo: number;
  bron: string | null;
};

const MAANDEN = [
  "",
  "Januari",
  "Februari",
  "Maart",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Augustus",
  "September",
  "Oktober",
  "November",
  "December",
];

function maandLabel(jaar: number, maand: number) {
  return `${MAANDEN[maand] ?? maand} ${jaar}`;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const huidigJaar = new Date().getFullYear();
    const totJaar = Number(url.searchParams.get("tot") ?? huidigJaar + 1);
    const entiteitKey = String(
      url.searchParams.get("entiteit") ?? "rekka"
    ) as EntiteitKey;

    if (
      !Number.isInteger(totJaar) ||
      totJaar < huidigJaar ||
      totJaar > huidigJaar + 10
    ) {
      return NextResponse.json(
        { success: false, error: "Ongeldig eindjaar" },
        { status: 400 }
      );
    }

    if (!(entiteitKey in ENTITEITEN)) {
      return NextResponse.json(
        { success: false, error: "Onbekende holding" },
        { status: 400 }
      );
    }

    const naam = ENTITEITEN[entiteitKey];
    const data = await berekenHoldingsMeerjaren(totJaar);
    const holding = data.holdings.find((item) => item.entity === naam);

    if (!holding) {
      return NextResponse.json(
        { success: false, fase: "4T-A", error: `${naam} ontbreekt in prognose` },
        { status: 404 }
      );
    }

    if (
      !holding.available ||
      holding.startBalance == null ||
      !holding.startDate ||
      holding.endingBalance == null
    ) {
      return NextResponse.json(
        {
          success: false,
          fase: "4T-A",
          error:
            holding.reason ||
            "Holdingprognose is nog niet volledig beschikbaar",
          ontbrekendeConfiguratie: holding.missingConfiguration ?? [],
        },
        { status: 409 }
      );
    }

    const regels: Regel[] = [];
    let saldo = round2(Number(holding.startBalance));
    let volgorde = 0;

    const startJaar = Number(String(holding.startDate).slice(0, 4));
    const startMaand = Number(String(holding.startDate).slice(5, 7));

    regels.push({
      volgorde: 0,
      jaar: startJaar,
      maand: startMaand,
      datumLabel: String(holding.startDate),
      omschrijving: `Startsaldo per ${holding.startDate}`,
      categorie: "start",
      in: 0,
      uit: 0,
      saldo,
      bron: "actief saldosnapshot",
    });

    for (const maand of holding.months) {
      for (const line of maand.lines) {
        const bedrag = round2(Number(line.amount ?? 0));
        if (bedrag <= 0) continue;

        saldo = round2(
          saldo + (line.direction === "in" ? bedrag : -bedrag)
        );
        volgorde += 1;

        regels.push({
          volgorde,
          jaar: Number(maand.year),
          maand: Number(maand.month),
          datumLabel: maandLabel(
            Number(maand.year),
            Number(maand.month)
          ),
          omschrijving: String(line.name),
          categorie: String(line.category),
          in: line.direction === "in" ? bedrag : 0,
          uit: line.direction === "uit" ? bedrag : 0,
          saldo,
          bron: line.source == null ? null : String(line.source),
        });
      }
    }

    const verwachtEindsaldo = round2(Number(holding.endingBalance));
    const eindsaldoOverzicht = round2(saldo);
    const verschil = round2(eindsaldoOverzicht - verwachtEindsaldo);

    const controle = {
      verwachtEindsaldo,
      eindsaldoOverzicht,
      verschil,
      aansluitingOk: Math.abs(verschil) < 0.01,
      aantalRegels: regels.length,
      btwRegels: regels.filter((regel) => regel.categorie === "btw").length,
      dividendRegels: regels.filter((regel) =>
        [
          "dividend",
          "dividendbelasting",
          "dividend_vincenzo_holding",
        ].includes(regel.categorie)
      ).length,
    };

    return NextResponse.json(
      {
        success: true,
        fase: "4T-A",
        entiteit: entiteitKey,
        entiteitNaam: holding.entity,
        peildatum: holding.startDate,
        totJaar,
        startsaldo: round2(Number(holding.startBalance)),
        eindsaldo: eindsaldoOverzicht,
        minimumKasbuffer: holding.minimumBuffer,
        regels,
        controle,
        controle4TA: controle,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[/api/admin/cashflow/holding-overzicht] error:", error);
    return NextResponse.json(
      { success: false, fase: "4T-A", error: String(error) },
      {
        status: 500,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
