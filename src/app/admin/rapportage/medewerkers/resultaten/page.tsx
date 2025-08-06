"use client";

import useSWR, { mutate } from "swr";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import ScrollToTopButton from "@/components/ScrollToTopButton";

interface Resultaat {
  id: string;
  email: string;
  naam: string;
  score: number;
  juist: number;
  totaal: number;
  titel: string;
  tijdstip: string;
}

export default function ResultatenOverzicht() {
  const router = useRouter();
  const [gebruiker, setGebruiker] = useState<{ naam: string; functie: string } | null>(null);

  useEffect(() => {
    fetch("/api/user")
      .then((res) => {
        if (!res.ok) throw new Error("Niet ingelogd");
        return res.json();
      })
      .then((data) => {
        if (data.functie?.toLowerCase() !== "beheerder") {
          router.push("/");
        } else {
          setGebruiker(data);
        }
      })
      .catch(() => router.push("/sign-in"));
  }, [router]);

  const [filterEmail, setFilterEmail] = useState<string>("alle");
  const { data, error } = useSWR<Resultaat[]>("/api/resultaten", async (url) => {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Fout bij ophalen resultaten");
    return res.json();
  }, { refreshInterval: 3000 });

  if (!gebruiker) return <main className="p-6">Bezig met controleren...</main>;
  if (error) return <div>Fout bij laden van resultaten.</div>;
  if (!data) return <div>Laden...</div>;

  const uniekeEmails = Array.from(new Set(data.map((r) => r.email))).sort();
  const gefilterd = filterEmail === "alle"
    ? data
    : data.filter((r) => r.email === filterEmail);



return (
  <div className="p-4">
    <Link href="/admin/rapportage/medewerkers" className="text-sm underline text-blue-600 block mb-2">
      🡐 Terug naar Rapportage Medewerkers
    </Link>
          <h1 className="text-2xl font-bold flex items-center gap-2">📊 Toetsresultaten</h1>

      <div className="mb-4">
        <label className="mr-2 font-medium">Filter op medewerker:</label>
        <select
          value={filterEmail}
          onChange={(e) => setFilterEmail(e.target.value)}
          className="border rounded px-2 py-1"
        >
          <option value="alle">Alle medewerkers</option>
          {uniekeEmails.map((email) => (
            <option key={email} value={email}>
              {email}
            </option>
          ))}
        </select>
      </div>

      <table className="w-full text-sm border-collapse border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">E-mail</th>
            <th className="border p-2 text-left">Naam</th>
            <th className="border p-2 text-center">Score</th>
            <th className="border p-2 text-center">Goed / Totaal</th>
            <th className="border p-2 text-center">Titel</th>
            <th className="border p-2 text-center">Tijdstip</th>
            <th className="border p-2 text-center">Actie</th>
          </tr>
        </thead>
        <tbody>
          {gefilterd.map((r, i) => (
            <tr key={i}>
              <td className="border p-2">{r.email}</td>
              <td className="border p-2">{r.naam}</td>
              <td className="border p-2 text-center">{r.score}%</td>
              <td className="border p-2 text-center">{r.juist} / {r.totaal}</td>
              <td className="border p-2 text-center">{r.titel}</td>
              <td className="border p-2 text-center">{new Date(r.tijdstip).toLocaleString()}</td>
              <td className="border p-2 text-center">
                <button
                  onClick={async () => {
                    if (confirm(`Verwijder resultaat van ${r.naam}?`)) {
                      await fetch(
                        `/api/resultaten?email=${encodeURIComponent(r.email)}&titel=${encodeURIComponent(r.titel)}`,
                        { method: "DELETE" }
                      );
                      mutate("/api/resultaten");
                    }
                  }}
                  className="text-red-600 underline text-sm"
                >
                  Verwijderen
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
       <ScrollToTopButton />
    </div>
  );
}
