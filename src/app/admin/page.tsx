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
}, [user, isAdmin, router]);

 const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  try {
    const res = await fetch("/api/instructies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titel, inhoud }),
    });

    console.log("📦 Status:", res.status);
    console.log("📦 Content-Type:", res.headers.get("content-type"));

    const rawText = await res.text();
    console.log("📦 Body als tekst:", rawText);

    let data;
    try {
      data = JSON.parse(rawText);
      console.log("✅ Parsed JSON:", data);
    } catch (err) {
      console.error("❌ JSON parsing error:", err);
      throw new Error("Backend gaf geen leesbaar JSON terug");
    }

    if (!res.ok || !data?.slug) {
      throw new Error("Geen instructie teruggekregen");
    }

    setInstructies((prev) => [...prev, { id: data.id || "placeholder", titel, inhoud }]);
    setTitel("");
    setInhoud("");
  } catch (err) {
    alert("Opslaan mislukt");
    console.error("🛑 Fout bij toevoegen:", err);
  }
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
