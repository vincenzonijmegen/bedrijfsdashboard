"use client";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export default function AdminPage() {
  const { user } = useUser();
  const router = useRouter();

  const [instructies, setInstructies] = useState<{ titel: string; inhoud: string }[]>([]);
  const [titel, setTitel] = useState("");
  const [inhoud, setInhoud] = useState("");

  const isAdmin = user?.primaryEmailAddress?.emailAddress === "herman@ijssalonvincenzo.nl";

  useEffect(() => {
    if (!user) return;
    if (!isAdmin) router.push("/dashboard");
  }, [user]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setInstructies((prev) => [...prev, { titel, inhoud }]);
    setTitel("");
    setInhoud("");
  };

  if (!isAdmin) return null;

  return (
    <main className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Admin: nieuwe instructie</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          className="border w-full p-2 rounded"
          type="text"
          placeholder="Titel"
          value={titel}
          onChange={(e) => setTitel(e.target.value)}
          required
        />
        <textarea
          className="border w-full p-2 rounded"
          rows={4}
          placeholder="Inhoud van de instructie"
          value={inhoud}
          onChange={(e) => setInhoud(e.target.value)}
        ></textarea>
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
          Instructie toevoegen
        </button>
      </form>

      <hr className="my-6" />

      <ul className="space-y-2">
        {instructies.map((i, idx) => (
          <li key={idx} className="border p-3 rounded bg-white shadow">
            <h2 className="font-semibold">{i.titel}</h2>
            <p className="text-sm">{i.inhoud}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}
