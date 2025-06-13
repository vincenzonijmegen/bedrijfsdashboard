"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function WachtwoordWijzigen() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const router = useRouter();

  const [wachtwoord, setWachtwoord] = useState("");
  const [herhaal, setHerhaal] = useState("");
  const [fout, setFout] = useState("");
  const [succes, setSucces] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFout("");
    setSucces("");

    if (wachtwoord.length < 6) {
      setFout("Wachtwoord moet minstens 6 tekens zijn.");
      return;
    }

    if (wachtwoord !== herhaal) {
      setFout("Wachtwoorden komen niet overeen.");
      return;
    }

    const res = await fetch("/api/wachtwoord-wijzigen", {
      method: "POST",
      body: JSON.stringify({ email, nieuwWachtwoord: wachtwoord }),
    });

    const data = await res.json();
    if (data.success) {
      setSucces("Wachtwoord gewijzigd. Je wordt doorgestuurd...");
      setTimeout(() => router.push("/instructies"), 2000);
    } else {
      setFout(data.error || "Er ging iets mis.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm mx-auto mt-20 space-y-4">
      <h1 className="text-xl font-semibold">Nieuw wachtwoord instellen</h1>

      <input
        type="email"
        value={email}
        readOnly
        className="w-full p-2 border rounded bg-gray-100"
      />

      <input
        type="password"
        placeholder="Nieuw wachtwoord"
        value={wachtwoord}
        onChange={(e) => setWachtwoord(e.target.value)}
        className="w-full p-2 border rounded"
        required
      />

      <input
        type="password"
        placeholder="Herhaal wachtwoord"
        value={herhaal}
        onChange={(e) => setHerhaal(e.target.value)}
        className="w-full p-2 border rounded"
        required
      />

      {fout && <p className="text-red-600">{fout}</p>}
      {succes && <p className="text-green-600">{succes}</p>}

      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
        Wachtwoord opslaan
      </button>
    </form>
  );
}
