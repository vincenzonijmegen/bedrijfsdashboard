"use client";

import useSWR from "swr";
import Link from "next/link";

interface Medewerker {
  email: string;
  naam: string;
  functie: string;
}

interface InstructieStatusRecord {
  email: string;
  gelezen_op?: string;
  score?: number;
  juist?: number;
  totaal?: number;
}

interface SkillStatusRecord {
  email: string;
  learned: number;
  total: number;
}

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function RapportagePagina() {
  const { data: medewerkers, error: mErr } = useSWR<Medewerker[]>('/api/admin/medewerkers', fetcher);
  const { data: instrStatus, error: iErr } = useSWR<InstructieStatusRecord[]>('/api/admin/instructiestatus', fetcher);
  const { data: skillsStatus, error: sErr } = useSWR<SkillStatusRecord[]>('/api/admin/skillsstatus', fetcher);

  if (mErr || iErr || sErr) return <div>Fout bij laden rapportage</div>;
  if (!medewerkers || !instrStatus || !skillsStatus) return <div>Laden rapportage...</div>;

  // Groepeer instructiestatus per medewerker
  const instrMap = instrStatus.reduce<Record<string, InstructieStatusRecord[]>>((acc, r) => {
    (acc[r.email] = acc[r.email] || []).push(r);
    return acc;
  }, {});

  // Zet skills status per medewerker in map
  const skillsMap = skillsStatus.reduce<Record<string, SkillStatusRecord>>((acc, r) => {
    acc[r.email] = r;
    return acc;
  }, {});

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Admin Rapportage</h1>
      <div className="overflow-x-auto">
        <table className="w-full table-auto border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2">Medewerker</th>
              <th className="border p-2">Instructies (Gelezen/Totaal)</th>
              <th className="border p-2">Skills (Geleerd/Totaal)</th>
            </tr>
          </thead>
          <tbody>
            {medewerkers.map((md) => {
              const instr = instrMap[md.email] || [];
              const gelezen = instr.filter(r => r.gelezen_op).length;
              const totaalI = instr.length;

              const skillRec = skillsMap[md.email] || { learned: 0, total: 0 };

              return (
                <tr key={md.email} className="hover:bg-gray-50">
                  <td className="border p-2">
                    <Link href={`/admin/medewerker/${md.email}`}>{md.naam}</Link>
                  </td>
                  <td className="border p-2 text-center">
                    <Link href={`/admin/medewerker/${md.email}/instructies`} className="text-blue-600 underline">
                      {gelezen}/{totaalI}
                    </Link>
                  </td>
                  <td className="border p-2 text-center">
                    <Link href={`/admin/medewerker/${md.email}/skills`} className="text-blue-600 underline">
                      {skillRec.learned}/{skillRec.total}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
