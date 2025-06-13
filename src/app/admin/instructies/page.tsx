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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
(i: unknown) => {
  const item = i as Instructie & { functies: string };
  return {
    ...item,
    functies: (() => {
      try {
        const parsed = JSON.parse(item.functies);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return item.functies;
}
        })(),
      };
    }
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
    <main className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-800">Instructies</h1>
        <Link href="/admin/instructies/nieuw">
          <Button>+ Nieuwe instructie</Button>
        </Link>
      </div>

      <div className="bg-white shadow-md rounded-xl overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="px-4 py-3">Nummer</th>
              <th className="px-4 py-3">Titel</th>
              <th className="px-4 py-3">Functies</th>
              <th className="px-4 py-3">Acties</th>
            </tr>
          </thead>
          <tbody>
            {gesorteerd.map((i: Instructie, idx) => (
              <tr key={i.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-4 py-3 align-top">{i.nummer || "-"}</td>
                <td className="px-4 py-3 align-top font-medium">{i.titel}</td>
                <td className="px-4 py-3 align-top text-gray-600 text-sm">
                  {Array.isArray(i.functies) ? (
                    <ul className="list-disc list-inside">
                      {i.functies.map((f, idx) => <li key={idx}>{f}</li>)}
                    </ul>
                  ) : "-"}
                </td>
                <td className="px-4 py-3 align-top">
                  <div className="flex gap-2">
                    <Link href={`/admin/instructies/${i.slug}/edit`}>
                      <Button variant="default" size="sm">Bewerken</Button>
                    </Link>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={async () => {
                        if (confirm(`Verwijder instructie: ${i.titel}?`)) {
                          await fetch(`/api/instructies/${i.slug}`, { method: "DELETE" });
                          location.reload();
                        }
                      }}
                    >
                      Verwijderen
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
