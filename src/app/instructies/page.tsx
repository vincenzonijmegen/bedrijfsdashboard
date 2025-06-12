"use client";

import useSWR from "swr";
import Link from "next/link";

interface Instructie {
  id: string;
  titel: string;
  nummer?: string;
  functies?: string[];
  slug: string;
}


const fetcher = async (url: string): Promise<Instructie[]> => {
  const res = await fetch(url);
  const data = await res.json();
  return data.map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (i: any) => ({
      ...i,
      functies: Array.isArray(i.functies)
        ? i.functies
        : typeof i.functies === "string"
        ? (() => {
            try {
              const parsed = JSON.parse(i.functies);
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          })()
        : []
    })
  );
};

export default function InstructieOverzicht() {
  const { data, error } = useSWR("/api/instructies", fetcher);

  if (error) return <div>Fout bij laden</div>;
  if (!data) return <div>Laden...</div>;

  const gesorteerd = [...data].sort((a, b) => {
    const na = a.nummer || "";
    const nb = b.nummer || "";
    return na.localeCompare(nb);
  });

  return (
    <main className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">📘 Werkinstructies</h1>

      <ul className="space-y-4">
        {gesorteerd.map((i) => (
          <li key={i.id} className="border p-4 rounded shadow bg-white">
            <Link href={`/instructies/${i.slug}`} className="block text-blue-600 font-semibold">
              {i.nummer ? `${i.nummer}. ` : ""}{i.titel}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
