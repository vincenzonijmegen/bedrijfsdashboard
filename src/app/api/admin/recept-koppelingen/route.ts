import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Status =
  | "naam_match"
  | "handmatig"
  | "gekoppeld"
  | "ontbreekt_kostprijs"
  | "controle_nodig"
  | "overslaan";

const responseInit = {
  headers: {
    "Cache-Control": "no-store, max-age=0",
  },
};

const normaliseerNaam = (waarde: unknown) =>
  String(waarde ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const geldigeStatus = (waarde: unknown): Status => {
  const status = String(waarde ?? "");
  if (
    status === "naam_match" ||
    status === "handmatig" ||
    status === "gekoppeld" ||
    status === "ontbreekt_kostprijs" ||
    status === "controle_nodig" ||
    status === "overslaan"
  ) {
    return status;
  }
  return "controle_nodig";
};

async function getKolommen(tabelNaam: string) {
  const res = await db.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1`,
    [tabelNaam]
  );

  return new Set(res.rows.map((row: { column_name: string }) => row.column_name));
}

export async function GET() {
  try {
    const [keukenKolommen, kostprijsKolommen] = await Promise.all([
      getKolommen("keuken_recepten"),
      getKolommen("recepten"),
    ]);

    const keukenHeeftCategorie = keukenKolommen.has("categorie");
    const keukenHeeftActief = keukenKolommen.has("actief");
    const kostprijsHeeftCategorie = kostprijsKolommen.has("categorie");

    const keukenCategorieSelect = keukenHeeftCategorie
      ? "categorie"
      : "NULL::text AS categorie";
    const keukenWhere = keukenHeeftActief ? "WHERE actief = true" : "";
    const keukenOrder = keukenHeeftCategorie
      ? "categorie NULLS LAST, naam ASC"
      : "naam ASC";

    const kostprijsCategorieSelect = kostprijsHeeftCategorie
      ? "COALESCE(categorie, '') AS categorie"
      : "''::text AS categorie";
    const kostprijsOrder = kostprijsHeeftCategorie
      ? "categorie NULLS LAST, naam ASC"
      : "naam ASC";
    const koppelingKostprijsCategorieSelect = kostprijsHeeftCategorie
      ? "COALESCE(r.categorie, '') AS kostprijs_categorie"
      : "''::text AS kostprijs_categorie";

    const [keukenRes, kostprijsRes, koppelingenRes] = await Promise.all([
      db.query(
        `SELECT id, naam, ${keukenCategorieSelect}
         FROM keuken_recepten
         ${keukenWhere}
         ORDER BY ${keukenOrder}`
      ),
      db.query(
        `SELECT id, naam, ${kostprijsCategorieSelect}
         FROM recepten
         ORDER BY ${kostprijsOrder}`
      ),
      db.query(
        `SELECT
           rk.id,
           rk.keuken_recept_id,
           rk.kostprijs_recept_id,
           rk.status,
           rk.opmerking,
           r.naam AS kostprijs_naam,
           ${koppelingKostprijsCategorieSelect}
         FROM recept_koppelingen rk
         LEFT JOIN recepten r ON r.id = rk.kostprijs_recept_id
         ORDER BY rk.keuken_recept_id ASC`
      ),
    ]);

    const kostprijsRecepten = kostprijsRes.rows.map((r: any) => ({
      id: Number(r.id),
      naam: String(r.naam ?? ""),
      categorie: r.categorie ?? "",
      zoeknaam: normaliseerNaam(r.naam),
    }));

    const koppelingenPerKeuken = new Map<number, any>();
    for (const koppeling of koppelingenRes.rows) {
      koppelingenPerKeuken.set(Number(koppeling.keuken_recept_id), koppeling);
    }

    const rijen = keukenRes.rows.map((keuken: any) => {
      const keukenId = Number(keuken.id);
      const bestaandeKoppeling = koppelingenPerKeuken.get(keukenId);
      const automatischeMatch = kostprijsRecepten.find(
        (r: any) => r.zoeknaam === normaliseerNaam(keuken.naam)
      );

      const kostprijsReceptId = bestaandeKoppeling?.kostprijs_recept_id
        ? Number(bestaandeKoppeling.kostprijs_recept_id)
        : null;
      const status = bestaandeKoppeling?.status
        ? geldigeStatus(bestaandeKoppeling.status)
        : automatischeMatch
          ? "naam_match"
          : "ontbreekt_kostprijs";

      return {
        id: bestaandeKoppeling?.id ? Number(bestaandeKoppeling.id) : null,
        keuken_recept_id: keukenId,
        keuken_naam: keuken.naam,
        keuken_categorie: keuken.categorie ?? "",
        kostprijs_recept_id: kostprijsReceptId,
        kostprijs_naam:
          bestaandeKoppeling?.kostprijs_naam ??
          (kostprijsReceptId
            ? kostprijsRecepten.find((r: any) => r.id === kostprijsReceptId)?.naam ?? null
            : null),
        kostprijs_categorie: bestaandeKoppeling?.kostprijs_categorie ?? "",
        status,
        opmerking: bestaandeKoppeling?.opmerking ?? "",
        automatische_match_id: automatischeMatch?.id ?? null,
        automatische_match_naam: automatischeMatch?.naam ?? null,
        berekenbaar:
          Boolean(kostprijsReceptId) &&
          status !== "ontbreekt_kostprijs" &&
          status !== "controle_nodig" &&
          status !== "overslaan",
      };
    });

    const samenvatting = {
      totaal: rijen.length,
      gekoppeld: rijen.filter(
        (r: any) =>
          r.kostprijs_recept_id &&
          r.status !== "controle_nodig" &&
          r.status !== "ontbreekt_kostprijs" &&
          r.status !== "overslaan"
      ).length,
      automatische_match: rijen.filter((r: any) => !r.id && r.automatische_match_id).length,
      ontbreekt: rijen.filter((r: any) => !r.kostprijs_recept_id && !r.automatische_match_id).length,
      controle_nodig: rijen.filter((r: any) => r.status === "controle_nodig").length,
      overgeslagen: rijen.filter((r: any) => r.status === "overslaan").length,
    };

    return NextResponse.json(
      {
        rijen,
        kostprijsRecepten: kostprijsRecepten.map(({ zoeknaam, ...rest }: any) => rest),
        samenvatting,
      },
      responseInit
    );
  } catch (err) {
    console.error("Fout bij ophalen receptkoppelingen:", err);
    return NextResponse.json(
      { error: "Kon receptkoppelingen niet ophalen" },
      { status: 500, ...responseInit }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const keukenReceptId = Number(body.keuken_recept_id);
    const kostprijsReceptId = body.kostprijs_recept_id ? Number(body.kostprijs_recept_id) : null;
    const status = geldigeStatus(body.status);
    const opmerking = body.opmerking ? String(body.opmerking).trim() : null;

    if (!keukenReceptId) {
      return NextResponse.json(
        { error: "keuken_recept_id ontbreekt" },
        { status: 400, ...responseInit }
      );
    }

    if ((status === "handmatig" || status === "gekoppeld" || status === "naam_match") && !kostprijsReceptId) {
      return NextResponse.json(
        { error: "Kies een kostprijsrecept bij deze status" },
        { status: 400, ...responseInit }
      );
    }

    const result = await db.query(
      `INSERT INTO recept_koppelingen
       (keuken_recept_id, kostprijs_recept_id, status, opmerking, bijgewerkt_op)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (keuken_recept_id)
       DO UPDATE SET
         kostprijs_recept_id = EXCLUDED.kostprijs_recept_id,
         status = EXCLUDED.status,
         opmerking = EXCLUDED.opmerking,
         bijgewerkt_op = now()
       RETURNING *`,
      [keukenReceptId, kostprijsReceptId, status, opmerking]
    );

    return NextResponse.json({ status: "ok", koppeling: result.rows[0] }, responseInit);
  } catch (err) {
    console.error("Fout bij opslaan receptkoppeling:", err);
    return NextResponse.json(
      { error: "Kon receptkoppeling niet opslaan" },
      { status: 500, ...responseInit }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const keukenReceptId = Number(req.nextUrl.searchParams.get("keuken_recept_id"));

  if (!keukenReceptId) {
    return NextResponse.json(
      { error: "keuken_recept_id ontbreekt" },
      { status: 400, ...responseInit }
    );
  }

  try {
    await db.query(`DELETE FROM recept_koppelingen WHERE keuken_recept_id = $1`, [keukenReceptId]);
    return NextResponse.json({ status: "verwijderd" }, responseInit);
  } catch (err) {
    console.error("Fout bij verwijderen receptkoppeling:", err);
    return NextResponse.json(
      { error: "Kon receptkoppeling niet verwijderen" },
      { status: 500, ...responseInit }
    );
  }
}
