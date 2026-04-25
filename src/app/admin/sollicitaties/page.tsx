"use client";

import useSWR from "swr";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function SollicitatiesPage() {
  const { data } = useSWR("/api/sollicitaties", fetcher);

  if (!data) return <div className="p-6">Laden...</div>;

  return (
    <main className="p-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Sollicitaties</h1>

      <div className="space-y-3">
        {data.map((s: any) => (
          <Link
            key={s.id}
            href={`/admin/sollicitaties/${s.id}`}
            className="block rounded-xl border p-4 bg-white hover:bg-slate-50"
          >
            <div className="flex justify-between">
              <div>
                <div className="font-semibold">
                  {s.voornaam} {s.achternaam}
                </div>
                <div className="text-sm text-slate-500">
                  {s.email} · {s.telefoon}
                </div>
              </div>

              <div className="text-sm text-slate-600">
                {s.status}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}