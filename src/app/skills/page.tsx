// /skills/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

export default function MijnSkillsPagina() {
  const session = useSession();
  const email = session?.data?.user?.email;
  const [skills, setSkills] = useState<any[]>([]);

  useEffect(() => {
    if (!email) return;

    fetch("/api/skills/mijn", {
      headers: {
        "x-user-email": email,
      },
    })
      .then((res) => res.json())
      .then((data) => setSkills(data.skills || []));
  }, [email]);

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Mijn Skills</h1>
      <table className="table-auto w-full border">
        <thead>
          <tr>
            <th className="border p-2">#</th>
            <th className="border p-2">Categorie</th>
            <th className="border p-2">Skill</th>
            <th className="border p-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {skills.map((s, i) => (
            <tr key={s.skill_id}>
              <td className="border p-2">{i + 1}</td>
              <td className="border p-2">{s.categorie}</td>
              <td className="border p-2">{s.skill_naam}</td>
              <td className="border p-2">{s.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
