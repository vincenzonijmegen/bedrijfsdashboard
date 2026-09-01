"use client";

import { useEffect, useMemo, useState } from "react";

interface Medewerker {
  id: string;
  first_name: string;
  prefix?: string;
  last_name: string;
  birthdate?: string;
  anonymized?: boolean;
}

function parseBirthdate(value?: string) {
  if (!value) return null;
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return null;

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function monthName(monthIndex: number) {
  return new Intl.DateTimeFormat("nl-NL", { month: "long" }).format(
    new Date(2000, monthIndex, 1)
  );
}

function formatBirthdate(value?: string) {
  const parsed = parseBirthdate(value);
  if (!parsed) return "-";

  return `${String(parsed.day).padStart(2, "0")}-${String(parsed.month).padStart(2, "0")}-${parsed.year}`;
}

export default function VerjaardagenSalarisrapport() {
  const [medewerkers, setMedewerkers] = useState<Medewerker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const rapportPeriode = useMemo(() => {
    const now = new Date();
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return {
      year: previousMonth.getFullYear(),
      month: previousMonth.getMonth() + 1,
      label: `${monthName(previousMonth.getMonth())} ${previousMonth.getFullYear()}`,
    };
  }, []);

  useEffect(() => {
    fetch("/api/shiftbase/naw", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error("Medewerkers konden niet worden opgehaald.");
        return res.json();
      })
      .then((json) => {
        const users = (json?.data || [])
          .map((item: any) => item.User)
          .filter((user: Medewerker | undefined) => user && user.anonymized === false);

        setMedewerkers(users);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, []);

  const jarigen = useMemo(() => {
    return medewerkers
      .map((medewerker) => {
        const birth = parseBirthdate(medewerker.birthdate);
        if (!birth || birth.month !== rapportPeriode.month) return null;

        const nieuweLeeftijd = rapportPeriode.year - birth.year;

        // 21 jaar is de laatste leeftijdsstap die nog tot een loonaanpassing kan leiden.
        if (nieuweLeeftijd > 21) return null;

        return { medewerker, birth, nieuweLeeftijd };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)
      .sort((a, b) => a.birth.day - b.birth.day || a.medewerker.last_name.localeCompare(b.medewerker.last_name));
  }, [medewerkers, rapportPeriode]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Salariscontrole verjaardagen</h1>
        <p className="text-sm text-gray-600 mt-1">
          Actieve medewerkers die in {rapportPeriode.label} jarig waren en nog een leeftijdsgebonden loonstap kunnen hebben.
        </p>
      </div>

      {loading && <p>Laden…</p>}

      {error && (
        <div className="rounded border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && jarigen.length === 0 && (
        <div className="rounded border border-gray-200 bg-gray-50 p-4">
          Geen medewerkers t/m 21 jaar die in {rapportPeriode.label} jarig waren.
        </div>
      )}

      {!loading && !error && jarigen.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border border-gray-300 text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="border px-3 py-2 text-left">Medewerker</th>
                <th className="border px-3 py-2 text-left">Geboortedatum</th>
                <th className="border px-3 py-2 text-left">Nieuwe leeftijd</th>
                <th className="border px-3 py-2 text-left">Actie</th>
              </tr>
            </thead>
            <tbody>
              {jarigen.map(({ medewerker, nieuweLeeftijd }) => (
                <tr key={medewerker.id}>
                  <td className="border px-3 py-2">
                    {medewerker.first_name} {medewerker.prefix ? `${medewerker.prefix} ` : ""}{medewerker.last_name}
                  </td>
                  <td className="border px-3 py-2">{formatBirthdate(medewerker.birthdate)}</td>
                  <td className="border px-3 py-2 font-medium">{nieuweLeeftijd} jaar</td>
                  <td className="border px-3 py-2">Bruto loon controleren / aanpassen</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-500">
        21 jaar wordt meegenomen omdat dit de laatste leeftijdsstap is; na 21 jaar hoeft het loon niet meer vanwege leeftijd te worden aangepast.
      </p>
    </div>
  );
}
