"use client";
import { useState } from "react";

export default function WachtwoordVergeten() {
  const [email, setEmail] = useState("");
  const [bevestiging, setBevestiging] = useState("");

  const handleVerzoek = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch("/api/reset-aanvraag", {
      method: "POST",
      body: JSON.stringify({ email }),
    });

    const data = await res.json();
    if (data.success) {
      setBevestiging("Er is een resetlink verstuurd als dit e-mailadres bestaat.");
    } else {
      setBevestiging("Er is iets misgegaan.");
    }
  };

  return (
    <form onSubmit={handleVerzoek} className="max-w-sm mx-auto mt-20 space-y-4">
      <h1 className="text-xl font-semibold">Wachtwoord vergeten</h1>
      <input
        type="email"
        required
        className="w-full p-2 border rounded"
        placeholder="E-mailadres"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button className="bg-blue-600 text-white px-4 py-2 rounded" type="submit">
        Verstuur resetlink
      </button>
      {bevestiging && <p className="text-green-600">{bevestiging}</p>}
    </form>
  );
}
