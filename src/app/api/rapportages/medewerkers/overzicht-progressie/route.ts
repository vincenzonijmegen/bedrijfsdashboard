import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

type MedewerkerRow = { id: number; email: string; naam: string; functie: string };
type InstructieRow = { id: string; functies: string | null };
type GelezenRow = { email: string; instructie_id: string };
type ToetsRow = { email: string; score: number };
type ToegewezenRow = { medewerker_id: number; skill_id: string };
type StatusRow = { medewerker_id: number; skill_id: string };

export async function GET(req: NextRequest) {
  try {
    // 1) Medewerkers
    const medResp = await db.query(`
      SELECT id, email, naam, functie
      FROM medewerkers
    `);
    const medewerkers = medResp.rows as MedewerkerRow[];

    // 2) Actieve instructies
    const instrResp = await db.query(`
      SELECT id, functies
      FROM instructies
      WHERE status = 'actief'
    `);
    const alleInstructies = instrResp.rows as InstructieRow[];

    // 3) Gelezen instructies
    const gelezenResp = await db.query(`
      SELECT email, instructie_id
      FROM gelezen_instructies
    `);
    const gelezen = gelezenResp.rows as GelezenRow[];

    // 4) Toetsresultaten
    const toetsResp = await db.query(`
      SELECT email, score
      FROM toetsresultaten
    `);
    const toetsen = toetsResp.rows as ToetsRow[];

    // 5) Toegewezen actieve skills
    const toegewezenResp = await db.query(`
      SELECT st.medewerker_id, st.skill_id
      FROM skill_toegewezen st
      JOIN skills s ON st.skill_id = s.id
      WHERE s.actief = true
    `);
    const toegewezen = toegewezenResp.rows as ToegewezenRow[];

    // 6) Voltooide skills
    const statusResp = await db.query(`
      SELECT medewerker_id, skill_id
      FROM skill_status
    `);
    const statusRows = statusResp.rows as StatusRow[];

    // 7) Instructiestatus per medewerker
    const instructiestatus = medewerkers.map((m) => {
      const relevant = alleInstructies.filter((i) => {
  if (!i.functies) return true;
  try {
    const f = JSON.parse(i.functies);
    return Array.isArray(f) && f.includes(m.functie); // ← dit is goed bij exact
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

      return { email: m.email, totaal, gelezen: gelezenAantal, geslaagd: geslaagdAantal };
    });

    // 8) Skillsstatus per medewerker
    const skillsstatus = medewerkers.map((m) => {
      const mijnToegewezen = toegewezen.filter((t) => t.medewerker_id === m.id);
      const totaalSkills = mijnToegewezen.length;
      const geleerd = statusRows.filter(
        (s) =>
          s.medewerker_id === m.id &&
          mijnToegewezen.some((t) => t.skill_id === s.skill_id)
      ).length;

      return { email: m.email, total: totaalSkills, learned: geleerd };
    });

    return NextResponse.json({ medewerkers, instructiestatus, skillsstatus });
  } catch (err: any) {
    console.error("Fout in overzicht-progressie API:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
