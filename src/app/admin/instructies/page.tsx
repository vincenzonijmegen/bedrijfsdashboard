"use client";

import useSWR, { mutate } from "swr";
import Link from "next/link";
import { Button } from "@/components/ui/button";

interface Instructie {
  id: string;
  titel: string;
  nummer?: string;
  functies?: string[]; // in DB soms als JSON-string
  slug: string;
}

function normalizeFuncties(f: unknown): string[] {
  if (Array.isArray(f)) return f as string[];
  if (typeof f === "string" && f.trim()) {
    try {
      const parsed = JSON.parse(f);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

export default function InstructieOverzicht() {
  const { data, error, isLoading } = useSWR<Instructie[]>("/api/instructies");

  if (error) return <div>Fout bij laden</div>;
  if (isLoading || !data) return <div>Laden...</div>;

  const gesorteerd = [...data]
    .map(i => ({ ...i, functies: normalizeFuncties(i.functies) }))
    .sort((a, b) => (a.nummer || "").localeCompare(b.nummer || ""));

  async function verwijder(slug: string, titel: string) {
    if (!confirm(`Verwijder instructie: ${titel}?`)) return;
    const res = await fetch(`/api/instructies/${slug}`, { method: "DELETE" });
    if (res.ok) {
      // SWR-cache updaten i.p.v. hele pagina reloaden
      mutate("/api/instructies", (old?: Instructie[]) =>
        (old || []).filter(i => i.slug !== slug), false
      );
    } else {
      alert("Verwijderen mislukt");
    }
  }

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
            {gesorteerd.map((i, idx) => (
              <tr key={i.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="px-4 py-3 align-top">{i.nummer || "-"}</td>
                <td className="px-4 py-3 align-top font-medium">
                  <Link href={`/admin/instructies/${i.slug}/preview`} className="text-blue-600 hover:underline">
                    {i.titel}
                  </Link>
                </td>
                <td className="px-4 py-3 align-top text-gray-600 text-sm">
                  {i.functies && i.functies.length ? (
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
                      onClick={() => verwijder(i.slug, i.titel)}
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
