import { NextRequest, NextResponse } from "next/server";
import { berekenVincenzoMeerjaren } from "@/lib/cashflow/berekenVincenzoMeerjaren";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Regel = {
  volgorde: number;
  jaar: number;
  maand: number;
  datumLabel: string;
  omschrijving: string;
  categorie:
    | "start"
    | "omzet"
    | "vast"
    | "loonkosten"
    | "inkoop"
    | "overig"
    | "incidenteel"
    | "holding"
    | "btw"
    | "vpb";
  in: number;
  uit: number;
  saldo: number;
  bron: string | null;
};

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

function maandNaam(maand: number) {
  return [
    "",
    "januari",
    "februari",
    "maart",
    "april",
    "mei",
    "juni",
    "juli",
    "augustus",
    "september",
    "oktober",
    "november",
    "december",
  ][maand] ?? String(maand);
}

function isTafStroom(naam?: string | null) {
  return String(naam ?? "").trim().toLowerCase() === "taf levensverzekering";
}

function btwOmschrijving(jaar: number, maand: number, bedrag: number) {
  let kwartaal: string;
  let betreftJaar = jaar;

  if (maand === 1) {
    kwartaal = "Q4";
    betreftJaar = jaar - 1;
  } else if (maand === 4) {
    kwartaal = "Q1";
  } else if (maand === 7) {
    kwartaal = "Q2";
  } else if (maand === 10) {
    kwartaal = "Q3";
  } else {
    kwartaal = "kwartaal";
  }

  return `BTW ${kwartaal} ${betreftJaar} · ${bedrag >= 0 ? "ontvangst" : "afdracht"}`;
}

function voegRegelToe(
  regels: Regel[],
  state: { saldo: number; volgorde: number },
  input: Omit<Regel, "saldo" | "volgorde" | "in" | "uit"> & {
    bedrag: number;
    richting: "in" | "uit";
  }
) {
  const bedrag = round2(Math.abs(input.bedrag));
  if (bedrag === 0) return;

  state.saldo = round2(
    state.saldo + (input.richting === "in" ? bedrag : -bedrag)
  );
  state.volgorde += 1;

  regels.push({
    volgorde: state.volgorde,
    jaar: input.jaar,
    maand: input.maand,
    datumLabel: input.datumLabel,
    omschrijving: input.omschrijving,
    categorie: input.categorie,
    in: input.richting === "in" ? bedrag : 0,
    uit: input.richting === "uit" ? bedrag : 0,
    saldo: state.saldo,
    bron: input.bron,
  });
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const huidigJaar = new Date().getFullYear();
    const totJaar = Number(url.searchParams.get("tot") ?? huidigJaar + 1);

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

    const data = await berekenVincenzoMeerjaren(totJaar);

    if (
      !data.basisjaar ||
      data.basisjaar.startsaldo == null ||
      !data.basisjaar.peildatum
    ) {
      return NextResponse.json(
        {
          success: false,
          fase: "4P-B",
          error: "Actief startsaldo/peildatum ontbreekt",
        },
        { status: 409 }
      );
    }

    const regels: Regel[] = [];
    const state = {
      saldo: round2(Number(data.basisjaar.startsaldo)),
      volgorde: 0,
    };

    const peildatum = String(data.basisjaar.peildatum);
    const afgeslotenTotMaand =
      Number(data.basisjaar.prognoseGrens?.afgeslotenTotMaand ?? 0);

    regels.push({
      volgorde: 0,
      jaar: huidigJaar,
      maand: afgeslotenTotMaand,
      datumLabel: peildatum,
      omschrijving: `Startsaldo per ${peildatum}`,
      categorie: "start",
      in: 0,
      uit: 0,
      saldo: state.saldo,
      bron: "actief saldosnapshot",
    });

    const verwerkMaand = (
      jaar: number,
      maandData: {
        maand: number;
        omzet?: number | null;
        omzetBron?: string | null;
        loonkosten?: number | null;
        loonkostenBron?: string | null;
        vasteStromen?: Array<{
          naam?: string;
          bedrag?: number | null;
        }>;
        inkoop?: number | null;
        inkoopBron?: string | null;
        overigeUitgaven?: number | null;
        overigeBron?: string | null;
        incidentelePosten?: Array<{
          datum?: string;
          omschrijving?: string;
          bedrag?: number;
          richting?: "in" | "uit";
        }>;
        incidenteleInkomsten?: number | null;
        incidenteleUitgaven?: number | null;
        aflossingSchuldHoldings?: number | null;
        dividendNaarHoldings?: number | null;
        btwKasMutatie?: number | null;
        vpbKasMutatie?: number | null;
      }
    ) => {
      const maand = Number(maandData.maand);
      const label = `${maandNaam(maand)} ${jaar}`;

      voegRegelToe(regels, state, {
        jaar,
        maand,
        datumLabel: label,
        omschrijving: "Omzet",
        categorie: "omzet",
        bedrag: Number(maandData.omzet ?? 0),
        richting: "in",
        bron: maandData.omzetBron ?? "prognose",
      });

      const incidentelePosten = Array.isArray(maandData.incidentelePosten)
        ? maandData.incidentelePosten
        : [];

      for (const post of incidentelePosten.filter(
        (p) => p.richting === "in"
      )) {
        voegRegelToe(regels, state, {
          jaar,
          maand,
          datumLabel: post.datum || label,
          omschrijving: post.omschrijving || "Incidentele ontvangst",
          categorie: "incidenteel",
          bedrag: Number(post.bedrag ?? 0),
          richting: "in",
          bron: "incidenteel",
        });
      }

      const vasteStromen = maandData.vasteStromen ?? [];
      const tafBedrag = round2(
        vasteStromen
          .filter((stroom) => isTafStroom(stroom.naam))
          .reduce((som, stroom) => som + Number(stroom.bedrag ?? 0), 0)
      );

      for (const stroom of vasteStromen.filter(
        (stroom) => !isTafStroom(stroom.naam)
      )) {
        voegRegelToe(regels, state, {
          jaar,
          maand,
          datumLabel: label,
          omschrijving: stroom.naam || "Vaste uitgave",
          categorie: "vast",
          bedrag: Number(stroom.bedrag ?? 0),
          richting: "uit",
          bron: "vast tarief",
        });
      }

      voegRegelToe(regels, state, {
        jaar,
        maand,
        datumLabel: label,
        omschrijving: "Loonkosten",
        categorie: "loonkosten",
        bedrag: Number(maandData.loonkosten ?? 0),
        richting: "uit",
        bron: maandData.loonkostenBron ?? "prognose",
      });

      voegRegelToe(regels, state, {
        jaar,
        maand,
        datumLabel: label,
        omschrijving: "Inkopen",
        categorie: "inkoop",
        bedrag: Number(maandData.inkoop ?? 0),
        richting: "uit",
        bron: maandData.inkoopBron ?? "omzetprofiel",
      });

      voegRegelToe(regels, state, {
        jaar,
        maand,
        datumLabel: label,
        omschrijving: "Overige reguliere uitgaven",
        categorie: "overig",
        bedrag: round2(Number(maandData.overigeUitgaven ?? 0) + tafBedrag),
        richting: "uit",
        bron:
          tafBedrag > 0
            ? `${maandData.overigeBron ?? "bankprofiel"} + TAF`
            : maandData.overigeBron ?? "bankprofiel",
      });

      for (const post of incidentelePosten.filter(
        (p) => p.richting === "uit"
      )) {
        voegRegelToe(regels, state, {
          jaar,
          maand,
          datumLabel: post.datum || label,
          omschrijving: post.omschrijving || "Incidentele uitgave",
          categorie: "incidenteel",
          bedrag: Number(post.bedrag ?? 0),
          richting: "uit",
          bron: "incidenteel",
        });
      }

      // Fallback voor oudere/basisdata waar alleen totalen beschikbaar zijn.
      if (incidentelePosten.length === 0) {
        voegRegelToe(regels, state, {
          jaar,
          maand,
          datumLabel: label,
          omschrijving: "Incidentele ontvangsten",
          categorie: "incidenteel",
          bedrag: Number(maandData.incidenteleInkomsten ?? 0),
          richting: "in",
          bron: "incidenteel",
        });
        voegRegelToe(regels, state, {
          jaar,
          maand,
          datumLabel: label,
          omschrijving: "Incidentele uitgaven",
          categorie: "incidenteel",
          bedrag: Number(maandData.incidenteleUitgaven ?? 0),
          richting: "uit",
          bron: "incidenteel",
        });
      }

      voegRegelToe(regels, state, {
        jaar,
        maand,
        datumLabel: label,
        omschrijving: "Aflossing schuld aan holdings / vrije ruimte",
        categorie: "holding",
        bedrag: Number(maandData.aflossingSchuldHoldings ?? 0),
        richting: "uit",
        bron: "uitkeringsplanning",
      });

      voegRegelToe(regels, state, {
        jaar,
        maand,
        datumLabel: label,
        omschrijving: "Dividend naar holdings",
        categorie: "holding",
        bedrag: Number(maandData.dividendNaarHoldings ?? 0),
        richting: "uit",
        bron: "uitkeringsplanning",
      });

      const btwKasMutatie = Number(maandData.btwKasMutatie ?? 0);
      if (btwKasMutatie !== 0) {
        voegRegelToe(regels, state, {
          jaar,
          maand,
          datumLabel: label,
          omschrijving: btwOmschrijving(jaar, maand, btwKasMutatie),
          categorie: "btw",
          bedrag: btwKasMutatie,
          richting: btwKasMutatie >= 0 ? "in" : "uit",
          bron: "BTW-prognose/werkelijkheid",
        });
      }

      const vpbKasMutatie = Number(maandData.vpbKasMutatie ?? 0);
      if (vpbKasMutatie !== 0) {
        voegRegelToe(regels, state, {
          jaar,
          maand,
          datumLabel: label,
          omschrijving: `Geraamde VPB ${jaar - 1}`,
          categorie: "vpb",
          bedrag: vpbKasMutatie,
          richting: vpbKasMutatie >= 0 ? "in" : "uit",
          bron: "VPB-planning",
        });
      }
    };

    // Basisjaar: alleen maanden ná de actieve peildatum. Het startsaldo
    // bevat alle werkelijkheid t/m die peildatum al.
    for (const maandData of data.basisjaar.maanden ?? []) {
      if (Number(maandData.maand) <= afgeslotenTotMaand) continue;
      verwerkMaand(huidigJaar, maandData);
    }

    // Daarna doorlopend alle toekomstige jaren.
    for (const jaarData of data.jaren ?? []) {
      for (const maandData of jaarData.maanden ?? []) {
        verwerkMaand(Number(jaarData.jaar), maandData);
      }
    }

    const verwachtEindsaldo =
      totJaar === huidigJaar
        ? data.basisjaar.eindsaldo
        : data.jaren.find((j) => j.jaar === totJaar)?.eindsaldo ?? null;

    const eindsaldoOverzicht = round2(state.saldo);
    const verschil =
      verwachtEindsaldo == null
        ? null
        : round2(eindsaldoOverzicht - Number(verwachtEindsaldo));

    return NextResponse.json(
      {
        success: true,
        fase: "4P-B",
        peildatum,
        totJaar,
        startsaldo: Number(data.basisjaar.startsaldo),
        eindsaldo: eindsaldoOverzicht,
        regels,
        controle4PB: {
          verwachtEindsaldo,
          eindsaldoOverzicht,
          verschil,
          aansluitingOk: verschil !== null && Math.abs(verschil) < 0.01,
          aantalRegels: regels.length,
          btwRegels: regels.filter((r) => r.categorie === "btw").length,
          vpbRegels: regels.filter((r) => r.categorie === "vpb").length,
        },
        // Backwards-compatible alias voor de bestaande overzichtspagina.
        controle4PA: {
          verwachtEindsaldo,
          eindsaldoOverzicht,
          verschil,
          aansluitingOk: verschil !== null && Math.abs(verschil) < 0.01,
          aantalRegels: regels.length,
          btwRegels: regels.filter((r) => r.categorie === "btw").length,
          vpbRegels: regels.filter((r) => r.categorie === "vpb").length,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[/api/admin/cashflow/kasstroomoverzicht] error:", error);
    return NextResponse.json(
      { success: false, fase: "4P-B", error: String(error) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
