"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function MedewerkerDetailPage() {
  const params = useParams();
  const email = decodeURIComponent(params?.email ?? "");
  const [data, setData] = useState<any | null>(null);
  const [fout, setFout] = useState<string | null>(null);

  useEffect(() => {
    if (!email) return;
    fetch(`/api/admin/medewerker/${encodeURIComponent(email)}`)
      .then((res) => {
        if (!res.ok) throw new Error("Niet gevonden");
        return res.json();
      })
      .then(setData)
      .catch(() => setFout("Kon medewerkergegevens niet laden."));
  }, [email]);

  if (fout) return <main className="p-6 text-red-600">{fout}</main>;
  if (!data) return <main className="p-6">Laden...</main>;

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">👤 Medewerker: {data.naam}</h1>
      <p><strong>Email:</strong> {data.email}</p>
      <p><strong>Functie:</strong> {data.functie}</p>

      {/* Je kunt hier tabjes of links naar instructies/skills/historie toevoegen */}
    </main>
  );
}
