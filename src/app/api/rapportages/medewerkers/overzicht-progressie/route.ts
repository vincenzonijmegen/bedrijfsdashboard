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
    const medResp = await db.query(`
      SELECT id, email, naam, functie
      FROM medewerkers
    `);
    const medewerkers = medResp.rows as MedewerkerRow[];

    const instrResp = await db.query(`
      SELECT id, functies
      FROM instructies
      WHERE status = 'actief'
    `);
    const alleInstructies = instrResp.rows as InstructieRow[];

    const gelezenResp = await db.query(`
      SELECT email, instructie_id
      FROM gelezen_instructies
    `);
    const gelezen = gelezenResp.rows as GelezenRow[];

    const toetsResp = await db.query(`
      SELECT email, score
      FROM toetsresultaten
    `);
    const toetsen = toetsResp.rows as ToetsRow[];

    const toegewezenResp = await db.query(`
      SELECT st.medewerker_id, st.skill_id
      FROM skill_toegewezen st
      JOIN skills s ON st.skill_id = s.id
      WHERE s.actief = true
    `);
    const toegewezen = toegewezenResp.rows as ToegewezenRow[];

    const statusResp = await db.query(`
      SELECT medewerker_id, skill_id
      FROM skill_status
      WHERE status = 'geleerd'
    `);
    const statusRows = statusResp.rows as StatusRow[];

    const instructiestatus = medewerkers.map((m) => {
      const relevant = alleInstructies.filter((i) => {
        if (!i.functies) return true;
        try {
          const functies = JSON.parse(i.functies);
          return Array.isArray(functies) && functies.includes(m.functie);
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

    const skillsstatus = medewerkers.map((m) => {
  const mijnToegewezen = toegewezen.filter((t) => t.medewerker_id === m.id);
  const totaalSkills = mijnToegewezen.length;

  const toegewezenSkillIDs = new Set(
    mijnToegewezen.map((s) => s.skill_id)
  );

  const geleerd = statusRows.filter(
    (s) =>
      s.medewerker_id === m.id && toegewezenSkillIDs.has(s.skill_id)
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
