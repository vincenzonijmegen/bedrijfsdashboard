"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface SkillStatus {
  skill_id: number;
  status: "geleerd" | "toegewezen" | "goedgekeurd";
  skill_naam: string;
  categorie: string;
}

export default function MijnSkills() {
  const [skills, setSkills] = useState<SkillStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const { data: session } = useSession();

  useEffect(() => {
    if (!session?.user?.email) return;

fetch("/api/skills/mijn", {
  headers: {
    "x-user-email": session.user.email,
  },
})

      .then((res) => res.json())
      .then((json) => {
        setSkills(json.skills || []);
        setLoading(false);
      });
  }, [session]);

  if (loading) return <p className="p-4">Laden…</p>;

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Mijn skills</h1>

      <table className="w-full border border-gray-300 text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-3 py-2 text-left">Categorie</th>
            <th className="border px-3 py-2 text-left">Skill</th>
            <th className="border px-3 py-2 text-left">Status</th>
          </tr>
        </thead>
        <tbody>
          {skills.map((s, index) => (
            <tr key={index}>
              <td className="border px-3 py-2">{s.categorie}</td>
              <td className="border px-3 py-2">{s.skill_naam}</td>
              <td className="border px-3 py-2 capitalize">{s.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
