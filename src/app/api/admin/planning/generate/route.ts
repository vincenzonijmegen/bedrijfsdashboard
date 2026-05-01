import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Medewerker = {
  email: string;
  naam: string;
  kan_scheppen: boolean;
  kan_voorbereiden: boolean;
  kan_ijsbereiden: boolean;
};

export async function POST(req: NextRequest) {
  try {
    const { periode_id } = await req.json();

    if (!periode_id) {
      return NextResponse.json(
        { error: "periode_id ontbreekt" },
        { status: 400 }
      );
    }

    await db.query(`DELETE FROM planning_toewijzingen WHERE periode_id = $1`, [
      periode_id,
    ]);

    const { rows } = await db.query(`
      SELECT
        email,
        naam,
        kan_scheppen,
        kan_voorbereiden,
        kan_ijsbereiden
      FROM medewerkers
    `);

    const medewerkers = rows as Medewerker[];

    const { rows: behoefte } = await db.query(
      `
      SELECT datum, shift_nr, functie, aantal
      FROM planning_shiftbehoefte
      WHERE periode_id = $1
      ORDER BY datum, shift_nr, functie
      `,
      [periode_id]
    );

    const { rows: afwezig } = await db.query(
      `
      SELECT medewerker_email, datum
      FROM planning_afwezigheid
      WHERE periode_id = $1
      `,
      [periode_id]
    );

    const afwezigSet = new Set(
      afwezig.map(
        (a) =>
          `${a.medewerker_email}_${new Date(a.datum).toISOString().slice(0, 10)}`
      )
    );

    const uniekeDatums = Array.from(
      new Set(behoefte.map((b) => new Date(b.datum).toISOString().slice(0, 10)))
    );

    const beschikbareDagenCount: Record<string, number> = {};

    for (const m of medewerkers) {
      let count = 0;

      for (const datum of uniekeDatums) {
        if (!afwezigSet.has(`${m.email}_${datum}`)) {
          count++;
        }
      }

      beschikbareDagenCount[m.email] = count;
    }

    const shiftCount: Record<string, number> = {};
    const shift1Count: Record<string, number> = {};
    const shift2Count: Record<string, number> = {};
    const geplandPerDag = new Set<string>();

    for (const b of behoefte) {
      const datum = new Date(b.datum).toISOString().slice(0, 10);

      for (let i = 0; i < Number(b.aantal || 0); i++) {
        const kandidaten = medewerkers.filter((m) => {
          if (b.functie === "scheppen" && !m.kan_scheppen) return false;
          if (b.functie === "voorbereiden" && !m.kan_voorbereiden) return false;
          if (b.functie === "ijsbereiden" && !m.kan_ijsbereiden) return false;

          if (afwezigSet.has(`${m.email}_${datum}`)) return false;
          if (geplandPerDag.has(`${m.email}_${datum}`)) return false;

          return true;
        });

        if (kandidaten.length === 0) continue;

        let beschikbareKandidaten = kandidaten.filter(
          (m) => (shiftCount[m.email] || 0) < 4
        );

        if (beschikbareKandidaten.length === 0) {
          beschikbareKandidaten = kandidaten.filter(
            (m) => (shiftCount[m.email] || 0) < 5
          );
        }

        if (beschikbareKandidaten.length === 0) continue;

        beschikbareKandidaten.sort((aMedewerker, bMedewerker) => {
          const beschikbaarA = beschikbareDagenCount[aMedewerker.email] || 99;
          const beschikbaarB = beschikbareDagenCount[bMedewerker.email] || 99;

          // Mensen met weinig beschikbare dagen krijgen voorrang,
          // maar alleen als het verschil duidelijk is.
          if (
            beschikbaarA !== beschikbaarB &&
            Math.abs(beschikbaarA - beschikbaarB) >= 3
          ) {
            return beschikbaarA - beschikbaarB;
          }

          const totaalA = shiftCount[aMedewerker.email] || 0;
          const totaalB = shiftCount[bMedewerker.email] || 0;

          if (totaalA !== totaalB) {
            return totaalA - totaalB;
          }

          const shift1A = shift1Count[aMedewerker.email] || 0;
          const shift1B = shift1Count[bMedewerker.email] || 0;
          const shift2A = shift2Count[aMedewerker.email] || 0;
          const shift2B = shift2Count[bMedewerker.email] || 0;

          const huidigeShiftA = b.shift_nr === 1 ? shift1A : shift2A;
          const huidigeShiftB = b.shift_nr === 1 ? shift1B : shift2B;

          if (huidigeShiftA !== huidigeShiftB) {
            return huidigeShiftA - huidigeShiftB;
          }

          if (beschikbaarA !== beschikbaarB) {
            return beschikbaarA - beschikbaarB;
          }

          return aMedewerker.naam.localeCompare(bMedewerker.naam);
        });

        const gekozen = beschikbareKandidaten[0];

        await db.query(
          `
          INSERT INTO planning_toewijzingen
            (periode_id, medewerker_email, datum, shift_nr, functie)
          VALUES ($1, $2, $3::date, $4, $5)
          `,
          [periode_id, gekozen.email, datum, b.shift_nr, b.functie]
        );

        shiftCount[gekozen.email] = (shiftCount[gekozen.email] || 0) + 1;

        if (b.shift_nr === 1) {
          shift1Count[gekozen.email] = (shift1Count[gekozen.email] || 0) + 1;
        } else {
          shift2Count[gekozen.email] = (shift2Count[gekozen.email] || 0) + 1;
        }

        geplandPerDag.add(`${gekozen.email}_${datum}`);
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Fout bij genereren planning:", e);
    return NextResponse.json({ error: "Genereren mislukt" }, { status: 500 });
  }
}