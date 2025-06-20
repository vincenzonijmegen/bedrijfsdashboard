"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

export default function WachtwoordReset() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [wachtwoord, setWachtwoord] = useState("");
  const [bevestiging, setBevestiging] = useState("");
  const [fout, setFout] = useState("");
  const [succes, setSucces] = useState(false);

  const verstuur = async () => {
    if (wachtwoord !== bevestiging) {
      setFout("Wachtwoorden komen niet overeen.");
      return;
    }
    if (!token) {
      setFout("Geen geldige resetlink.");
      return;
    }

    const res = await fetch("/api/wachtwoord-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, nieuwWachtwoord: wachtwoord })
    });

    const data = await res.json();
    if (data.success) {
      setSucces(true);
      setFout("");
      setTimeout(() => router.push("/login"), 3000);
    } else {
      setFout(data.error || "Er ging iets mis.");
    }
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-4 border bg-white rounded shadow">
      <h1 className="text-xl font-bold mb-4">🔐 Stel nieuw wachtwoord in</h1>
      {succes ? (
        <p className="text-green-600">Wachtwoord succesvol aangepast. Je wordt doorgestuurd...</p>
      ) : (
        <>
          <input
            type="password"
            placeholder="Nieuw wachtwoord"
            value={wachtwoord}
            onChange={(e) => setWachtwoord(e.target.value)}
            className="w-full border p-2 rounded mb-2"
          />
          <input
            type="password"
            placeholder="Bevestig wachtwoord"
            value={bevestiging}
            onChange={(e) => setBevestiging(e.target.value)}
            className="w-full border p-2 rounded mb-2"
          />
          {fout && <p className="text-red-600 text-sm mb-2">{fout}</p>}
          <button
            onClick={verstuur}
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
          >
            Stel wachtwoord in
          </button>
        </>
      )}
    </div>
  );
}
