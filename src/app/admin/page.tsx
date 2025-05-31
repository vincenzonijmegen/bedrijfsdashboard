"use client";
import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Instructie = { id: string; titel: string; inhoud: string };

export default function AdminPage() {
  const { user } = useUser();
  const router = useRouter();
  const [instructies, setInstructies] = useState<Instructie[]>([]);
  const [titel, setTitel] = useState("");
  const [inhoud, setInhoud] = useState("");

  const isAdmin = user?.primaryEmailAddress?.emailAddress === "herman@ijssalonvincenzo.nl";

  useEffect(() => {
    if (!user) return;
    if (!isAdmin) router.push("/dashboard");
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();

  const res = await fetch("/api/instructies", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ titel, inhoud }),
  });

  const data = await res.json();
  setInstructies((prev) => [...prev, data.instructie]);
  setTitel("");
  setInhoud("");
};


  if (!isAdmin) return null;

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Beheer: nieuwe instructie</h1>

      <form onSubmit={handleSubmit} className="space-y-4 mb-8">
        <input
          type="text"
          placeholder="Titel"
          value={titel}
          onChange={(e) => setTitel(e.target.value)}
          className="w-full border p-2 rounded"
          required
        />
        <textarea
          placeholder="Inhoud"
          value={inhoud}
          onChange={(e) => setInhoud(e.target.value)}
          className="w-full border p-2 rounded"
          rows={4}
        />
        <button className="bg-blue-600 text-white px-4 py-2 rounded">Toevoegen</button>
      </form>

      <ul className="space-y-3">
        {instructies.map((i) => (
          <li key={i.id} className="border bg-white p-4 rounded shadow">
            <h2 className="font-semibold">{i.titel}</h2>
            <p className="text-sm mt-1">{i.inhoud}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
