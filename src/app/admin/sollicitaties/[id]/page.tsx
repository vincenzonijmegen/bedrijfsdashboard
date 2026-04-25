"use client";
import { useMemo, useState } from "react";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function SollicitatieDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [id, setId] = useState<string | null>(null);

  useMemo(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  const { data } = useSWR(
    id ? `/api/sollicitaties/${id}` : null,
    fetcher
  );

  if (!data) return <div className="p-6">Laden...</div>;

  return (
    <main className="p-6 max-w-4xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">
        {data.voornaam} {data.achternaam}
      </h1>

      {/* GEGEVENS */}
      <section className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold mb-2">Gegevens</h2>
        <div className="text-sm space-y-1">
          <div>Email: {data.email}</div>
          <div>Tel: {data.telefoon}</div>
          <div>
            Adres: {data.adres} {data.huisnummer}, {data.postcode}{" "}
            {data.woonplaats}
          </div>
          <div>Geboortedatum: {data.geboortedatum}</div>
        </div>
      </section>

      {/* BESCHIKBAARHEID */}
      <section className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold mb-2">Beschikbaarheid</h2>
        <ul className="list-disc ml-5 text-sm">
          {data.beschikbaar_momenten?.map((m: string) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </section>

      {/* OVERIG */}
      <section className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold mb-2">Overig</h2>
        <div className="text-sm space-y-1">
          <div>Bijbaan: {data.bijbaan}</div>
          <div>Shifts: {data.shifts_per_week}</div>
          <div>Voorkeur: {data.voorkeur_functie}</div>
          <div>Vakantie: {data.vakantie}</div>
        </div>
      </section>

      {/* MOTIVATIE */}
      <section className="bg-white border rounded-xl p-4">
        <h2 className="font-semibold mb-2">Motivatie</h2>
        <p className="text-sm whitespace-pre-wrap">
          {data.motivatie}
        </p>
      </section>
    </main>
  );
}