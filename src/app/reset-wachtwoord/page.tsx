"use client";
import { useSearchParams, useRouter } from "next/navigation";
import { useState } from "react";

export default function ResetWachtwoord() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [wachtwoord, setWachtwoord] = useState("");
  const [herhaal, setHerhaal] = useState("");
  const [fout, setFout] = useState("");
  const [succes, setSucces] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
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

    const res = await fetch("/api/reset-wachtwoord", {
      method: "POST",
      body: JSON.stringify({ token, nieuwWachtwoord: wachtwoord }),
    });

    const data = await res.json();
    if (data.success) {
      setSucces("Wachtwoord gewijzigd! Je wordt doorgestuurd...");
      setTimeout(() => router.push("/sign-in"), 3000);
    } else {
      setFout(data.error || "Ongeldige of verlopen link.");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-sm mx-auto mt-20 space-y-4">
      <h1 className="text-xl font-semibold">Nieuw wachtwoord instellen</h1>
      <input
        type="password"
        placeholder="Nieuw wachtwoord"
        className="w-full p-2 border rounded"
        value={wachtwoord}
        onChange={(e) => setWachtwoord(e.target.value)}
      />
      <input
        type="password"
        placeholder="Herhaal wachtwoord"
        className="w-full p-2 border rounded"
        value={herhaal}
        onChange={(e) => setHerhaal(e.target.value)}
      />
      {fout && <p className="text-red-600">{fout}</p>}
      {succes && <p className="text-green-600">{succes}</p>}
      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
        Opslaan
      </button>
    </form>
  );
}
