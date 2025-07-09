"use client";

import useSWR from "swr";
import Link from "next/link";

interface Medewerker {
  id: number;
  email: string;
  naam: string;
  functie: string;
}

interface Instructiestatus {
  email: string;
  gelezen: number;
  totaal: number;
  geslaagd: number;
}

interface Skillstatus {
  email: string;
  learned: number;
  total: number;
}

interface Data {
  medewerkers: Medewerker[];
  instructiestatus: Instructiestatus[];
  skillsstatus: Skillstatus[];
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function OverzichtProgressiePagina() {
  const { data, error } = useSWR<Data>(
    "/api/rapportages/medewerkers/overzicht-progressie",
    fetcher
  );

  if (error) return <div className="p-4">Fout bij laden rapportage</div>;
  if (!data) return <div className="p-4">Laden...</div>;

  if (
    !Array.isArray(data.medewerkers) ||
    !Array.isArray(data.instructiestatus) ||
    !Array.isArray(data.skillsstatus)
  ) {
    return <div className="p-4">Onvolledige data ontvangen</div>;
  }

  const instrMap = Object.fromEntries(
    data.instructiestatus.map((r) => [r.email, r])
  );
  const skillsMap = Object.fromEntries(
    data.skillsstatus.map((r) => [r.email, r])
  );

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">
        📊 Overzicht voortgang medewerkers
      </h1>
      <div className="overflow-x-auto">
        <table className="w-full table-auto border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2 text-left">Naam</th>
              <th className="border p-2 text-left">Functie</th>
              <th className="border p-2 text-center">Instructies</th>
              <th className="border p-2 text-center">Geslaagd</th>
              <th className="border p-2 text-center">Skills</th>
            </tr>
          </thead>
          <tbody>
            {data.medewerkers.map((m) => {
              const i = instrMap[m.email] || {
                gelezen: 0,
                totaal: 0,
                geslaagd: 0,
              };
              const s = skillsMap[m.email] || { learned: 0, total: 0 };
              return (
                <tr key={m.email} className="hover:bg-gray-50">
                <td className="border p-2">
                <div className="flex flex-col gap-1">
                    <Link
                    href={`/admin/medewerker/${encodeURIComponent(m.email)}`}
                    className="text-blue-600 underline"
                    >
                    {m.naam}
                    </Link>
                    <Link
                    href={`/admin/medewerker/${encodeURIComponent(m.email)}/dashboard`}
                    className="text-sm text-blue-500 underline"
                    >
                    🔍 Bekijk dashboard
                    </Link>
                </div>
                </td>

                  <td className="border p-2">{m.functie}</td>
                  <td className="border p-2 text-center">
                    {i.gelezen} / {i.totaal}
                  </td>
                  <td className="border p-2 text-center">{i.geslaagd}</td>
                  <td className="border p-2 text-center">
                    {s.learned} / {s.total}
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
