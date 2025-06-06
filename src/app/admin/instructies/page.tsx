"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Instructie = { id: string; titel: string; slug: string };

export default function InstructieOverzicht() {
  const [instructies, setInstructies] = useState<Instructie[]>([]);

useEffect(() => {
  fetch("/api/instructies")
    .then((res) => res.json())
    .then((data) => {
      console.log("📦 Gehaalde instructies:", data);
      setInstructies(data);
    });
}, []);

useEffect(() => {
  fetch("/api/instructies")
    .then((res) => res.json())
    .then((data) => {
      console.log("📦 Instructies ontvangen:", data);
      setInstructies(data);
    });
}, []);

  return (
    <main className="max-w-3xl mx-auto p-4 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Instructiebeheer</h1>
        <Link href="/admin/instructies/nieuw" className="bg-blue-600 text-white px-4 py-2 rounded">
          ➕ Nieuwe instructie
        </Link>
      </div>

      <ul className="space-y-3">
        {instructies.map((i) => (
          <li key={i.id} className="border p-4 rounded bg-white">
            <div className="flex justify-between items-center">
              <h2 className="font-semibold">{i.titel}</h2>
              <Link href={`/admin/instructies/${i.slug}`} className="text-blue-600 underline text-sm">
                Bewerken
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
