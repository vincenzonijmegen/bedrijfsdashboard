import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    // 1) Medewerkers ophalen (incl. id voor skills-joins)
    const { rows: medewerkers } = await db.query<{
      id: number;
      email: string;
      naam: string;
      functie: string;
    }>(`
      SELECT id, email, naam, functie
      FROM medewerkers
    `);

    // 2) Actieve instructies ophalen (met JSON-array in 'functies')
    const { rows: alleInstructies } = await db.query<{
      id: string;
      functies: string | null;
    }>(`
      SELECT id, functies
      FROM instructies
      WHERE status = 'actief'
    `);

    // 3) Gelezen instructies per e-mail
    const { rows: gelezen } = await db.query<{
      email: string;
      instructie_id: string;
    }>(`
      SELECT email, instructie_id
      FROM gelezen_instructies
    `);

    // 4) Toetsresultaten per e-mail
    const { rows: toetsen } = await db.query<{
      email: string;
      score: number;
    }>(`
      SELECT email, score
      FROM toetsresultaten
    `);

    // 5) Toegewezen skills (actieve skills alleen)
    const { rows: toegewezen } = await db.query<{
      medewerker_id: number;
      skill_id: string;
    }>(`
      SELECT st.medewerker_id, st.skill_id
      FROM skill_toegewezen st
      JOIN skills s ON st.skill_id = s.id
      WHERE s.actief = true
    `);

    // 6) Voltooide skills (alle status-entries)
    const { rows: statusRows } = await db.query<{
      medewerker_id: number;
      skill_id: string;
    }>(`
      SELECT medewerker_id, skill_id
      FROM skill_status
    `);

    // 7) Bouw instructiestatus per medewerker
    const instructiestatus = medewerkers.map((m) => {
      const relevant = alleInstructies.filter((i) => {
        if (!i.functies) return true;
        try {
          const f = JSON.parse(i.functies);
          return Array.isArray(f) && f.includes(m.functie);
        } catch {
          return false;
        }
      });
      const totaal = relevant.length;
      const gelezenAantal = gelezen.filter(
        (g) =>
          g.email === m.email &&
          relevant.some((r) => r.id === g.instructie_id)
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

    // 8) Bouw skillsstatus per medewerker
    const skillsstatus = medewerkers.map((m) => {
      const mijnToegewezen = toegewezen.filter(
        (t) => t.medewerker_id === m.id
      );
      const totaalSkills = mijnToegewezen.length;
      const geleerd = statusRows.filter(
        (s) =>
          s.medewerker_id === m.id &&
          mijnToegewezen.some((t) => t.skill_id === s.skill_id)
      ).length;

      return {
        email: m.email,
        total: totaalSkills,
        learned: geleerd,
      };
    });

    return NextResponse.json({ medewerkers, instructiestatus, skillsstatus });
  } catch (err: any) {
    console.error("Fout in overzicht-progressie API:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
