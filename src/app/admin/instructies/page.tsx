"use client";

import useSWR from "swr";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface Instructie {
  id: string;
  titel: string;
  nummer?: string;
  functies?: string[];
  slug: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fetcher = async (url: string): Promise<Instructie[]> => {
  const res = await fetch(url);
  const data = await res.json();
  return data.map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (i: any) => ({
      ...i,
      functies: (() => {
      try {
        const parsed = JSON.parse(i.functies);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return i.functies;
      }
    })(),
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
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Instructies</h1>
        <Link href="/admin/instructies/nieuw">
          <Button>+ Nieuwe instructie</Button>
        </Link>
      </div>

      <table className="w-full border border-gray-300 text-left">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-4 py-2">Nummer</th>
            <th className="border px-4 py-2">Titel</th>
            <th className="border px-4 py-2">Functies</th>
            <th className="border px-4 py-2">Acties</th>
          </tr>
        </thead>
        <tbody>
          {gesorteerd.map((i: Instructie) => (
            <tr key={i.id} className="border-t">
              <td className="border px-4 py-2 align-top">{i.nummer || "-"}</td>
              <td className="border px-4 py-2 align-top">{i.titel}</td>
              <td className="border px-4 py-2 align-top text-sm text-gray-600">
                {Array.isArray(i.functies) ? i.functies.join(", ") : "-"}
              </td>
              <td className="border px-4 py-2 align-top">
  <Link href={`/admin/instructies/${i.slug}/edit`} className="text-blue-600 underline">
    Bewerken
  </Link>
  <button
    onClick={async () => {
      if (confirm(`Verwijder instructie: ${i.titel}?`)) {
        await fetch(`/api/instructies/${i.slug}`, { method: "DELETE" });
        location.reload();
      }
    }}
    className="text-red-600 underline ml-4"
  >
    Verwijderen
  </button>
</td>

            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
