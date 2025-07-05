"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Medewerker {
  id: string;
  first_name: string;
  prefix?: string;
  last_name: string;
  email: string;
  phone_nr?: string;
  birthdate?: string;
}

function formatDateNL(dateString?: string): string {
  if (!dateString) return "-";
  const date = new Date(dateString);
  return date.toLocaleDateString("nl-NL");
}

export default function MedewerkersOverzicht() {
  const [data, setData] = useState<Medewerker[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/shiftbase/naw")
      .then((res) => res.json())
      .then((json) => {
        const gebruikers = (json?.data || [])
          .map((item: any) => item.User)
          .filter((user: any) => user?.anonymized === false);
        setData(gebruikers);
        setLoading(false);
      });
  }, []);

  if (loading) return <p className="p-4">Laden…</p>;

  return (
    <div className="p-4 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Actieve medewerkers</h1>

      <table className="w-full border border-gray-300 text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-3 py-2 text-left">#</th>
            <th className="border px-3 py-2 text-left">Naam</th>
            <th className="border px-3 py-2 text-left">Geboortedatum</th>
            <th className="border px-3 py-2 text-left">Telefoonnummer</th>
            <th className="border px-3 py-2 text-left">E-mailadres</th>
          </tr>
        </thead>
        <tbody>
          {data.map((m, index) => (
            <tr key={m.id}>
              <td className="border px-3 py-2">{index + 1}</td>
              <td className="border px-3 py-2">
                {m.first_name} {m.prefix ? m.prefix + " " : ""}{m.last_name}
              </td>
              <td className="border px-3 py-2">
                {formatDateNL(m.birthdate)}
              </td>
              <td className="border px-3 py-2">
                {m.phone_nr || "-"}
              </td>
              <td className="border px-3 py-2">{m.email || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <Link
        href="/"
        className="inline-block mt-6 text-blue-600 hover:underline font-medium"
      >
        ← Terug naar startpagina
      </Link>
    </div>
  );
}
