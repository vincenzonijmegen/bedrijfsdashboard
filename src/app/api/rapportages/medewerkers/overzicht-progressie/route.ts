import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    // Haal alle medewerkers op met hun e-mail, naam, functie
    const { rows: medewerkers } = await db.query(
      `SELECT email, naam, functie FROM medewerkers`
    );

    // Haal instructies met functiefilter op
    const { rows: alleInstructies } = await db.query(
      `SELECT id, functies FROM instructies WHERE status = 'actief'`
    );

    // Haal gelezen instructies
    const { rows: gelezen } = await db.query(
      `SELECT email, instructie_id FROM gelezen_instructies`
    );

    // Haal toetsresultaten
    const { rows: toetsen } = await db.query(
      `SELECT email, score FROM toetsresultaten`
    );

    // Haal alle skills met functiefilter op
    const { rows: alleSkills } = await db.query(
      `SELECT id, functies FROM skills WHERE status = 'actief'`
    );

    // Haal behaalde skills
    const { rows: behaaldeSkills } = await db.query(
      `SELECT email, skill_id FROM behaalde_skills`
    );

    // Genereer instructiestatus per medewerker
    const instructiestatus = medewerkers.map((m) => {
      const relevante = alleInstructies.filter((i) => {
        if (!i.functies) return true;
        try {
          const f = JSON.parse(i.functies);
          return Array.isArray(f) && f.includes(m.functie);
        } catch {
          return false;
        }
      });

      const totaal = relevante.length;
      const gelezenAantal = gelezen.filter(
        (g) =>
          g.email === m.email &&
          relevante.some((r) => r.id === g.instructie_id)
      ).length;
      const geslaagdAantal = toetsen.filter(
        (t) => t.email === m.email && t.score >= 80
      ).length;

      return {
        email: m.email,
        totaal,
        gelezen: gelezenAantal,
        geslaagd: geslaagdAantal,
      };
    });

    // Genereer skillsstatus per medewerker
    const skillsstatus = medewerkers.map((m) => {
      const relevanteSkills = alleSkills.filter((s) => {
        if (!s.functies) return true;
        try {
          const f = JSON.parse(s.functies);
          return Array.isArray(f) && f.includes(m.functie);
        } catch {
          return false;
        }
      });

      const totalSkills = relevanteSkills.length;
      const learnedCount = behaaldeSkills.filter(
        (b) =>
          b.email === m.email &&
          relevanteSkills.some((r) => r.id === b.skill_id)
      ).length;

      return {
        email: m.email,
        total: totalSkills,
        learned: learnedCount,
      };
    });

    return NextResponse.json({ medewerkers, instructiestatus, skillsstatus });
  } catch (err: any) {
    console.error("Fout in overzicht-progressie API:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
