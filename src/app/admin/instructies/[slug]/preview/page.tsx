// src/app/admin/instructies/[slug]/preview/page.tsx

"use client";

import { notFound, useParams } from "next/navigation";
import { useEffect, useState } from "react";
import parse from "html-react-parser";

interface Vraag {
  vraag: string;
  opties: string[];
  juist: number;
}

interface Instructie {
  id: string;
  slug: string;
  titel: string;
  inhoud: string;
  vragen: Vraag[];
}

export default function InstructiePreview() {
  const { slug } = useParams();
  const [data, setData] = useState<Instructie | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/instructies/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error("Niet gevonden");
        return res.json();
      })
      .then((data) => setData(data))
      .catch((err) => setError(err.message));
  }, [slug]);

  if (error) return <div className="p-6 text-red-600">Fout: {error}</div>;
  if (!data) return <div className="p-6">Laden...</div>;

  const chunks = data.inhoud.split("[end]");

  return (
    <main className="max-w-3xl mx-auto p-6 space-y-8">
      <h1 className="text-3xl font-bold text-gray-800">{data.titel}</h1>

      <section className="prose prose-sm sm:prose lg:prose-lg max-w-none">
        {chunks.map((chunk, index) => (
          <div key={index} className="mb-8">
            {parse(chunk)}
            {index < chunks.length - 1 && <hr className="my-6 border-t-2 border-gray-300" />}
          </div>
        ))}
      </section>

      {data.vragen?.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-semibold mb-4">Toetsvragen</h2>
          <ol className="space-y-6 list-decimal list-inside">
            {data.vragen.map((vraag, idx) => (
              <li key={idx}>
                <div className="font-medium mb-2">{vraag.vraag}</div>
                <ul className="pl-4 list-disc text-gray-700">
                  {vraag.opties.map((optie, i) => (
                    <li key={i} className={i === vraag.juist ? "font-semibold text-green-700" : ""}>
                      {optie}
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        </section>
      )}
    </main>
  );
}
