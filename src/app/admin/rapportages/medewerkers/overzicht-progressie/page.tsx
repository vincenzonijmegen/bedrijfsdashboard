"use client";

import useSWR from "swr";
import Link from "next/link";
import { useState } from "react";

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

  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);

  const toggleSelect = (email: string) => {
    setSelectedEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  const handleMailClick = () => {
    const bcc = selectedEmails.join(",");
    const subject = encodeURIComponent("Herinnering werkinstructies");
    const body = encodeURIComponent(
      `Beste collega,\n\nJe hebt nog geen werkinstructies gelezen. Wil je dit z.s.m. doen?\n\nGa naar: https://werkinstructies-app.vercel.app\n\nMet vriendelijke groet,\nTeam IJssalon Vincenzo`
    );
    window.location.href = `mailto:?bcc=${bcc}&subject=${subject}&body=${body}`;
  };

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
      <button
        onClick={handleMailClick}
        disabled={selectedEmails.length === 0}
        className="mb-4 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        📩 Mail geselecteerde medewerkers
      </button>
      <div className="overflow-x-auto">
        <table className="w-full table-auto border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2 text-left">Selecteer</th>
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
              const magGeselecteerd = i.gelezen === 0 && i.totaal > 0;
              return (
                <tr key={m.email} className="hover:bg-gray-50">
                  <td className="border p-2 text-center">
                    {magGeselecteerd && (
                      <input
                        type="checkbox"
                        checked={selectedEmails.includes(m.email)}
                        onChange={() => toggleSelect(m.email)}
                      />
                    )}
                  </td>
                  <td className="border p-2">
                    <Link
                      href={`/admin/medewerker/${encodeURIComponent(m.email)}/dashboard`}
                      className="text-blue-600 underline"
                    >
                      {m.naam}
                    </Link>
                  </td>
                  <td className="border p-2">{m.functie}</td>
                  <td
                    className={`border p-2 text-center ${
                      i.totaal === 0
                        ? "bg-gray-100"
                        : i.gelezen === 0
                        ? "bg-red-100"
                        : i.gelezen < i.totaal
                        ? "bg-yellow-100"
                        : "bg-green-100"
                    }`}
                  >
                    {i.gelezen} / {i.totaal}
                  </td>
                  <td className="border p-2 text-center">{i.geslaagd}</td>
                  <td
                    className={`border p-2 text-center ${
                      s.total === 0
                        ? "bg-gray-100"
                        : s.learned === 0
                        ? "bg-red-100"
                        : s.learned < s.total
                        ? "bg-yellow-100"
                        : "bg-green-100"
                    }`}
                  >
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
