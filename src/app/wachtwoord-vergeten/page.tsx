"use client";

import { useState } from "react";

export default function WachtwoordVergeten() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  const verstuur = async () => {
    const res = await fetch("/api/wachtwoord-reset-aanvragen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });

    if (res.status === 404) {
      setStatus("notfound");
    } else if (!res.ok) {
      setStatus("serverfout");
    } else {
      const data = await res.json();
      if (data.success) {
        setStatus("success");
      } else {
        setStatus("serverfout");
      }
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-4 border rounded bg-white shadow">
      <h1 className="text-xl font-bold mb-4">🔑 Wachtwoord vergeten?</h1>
      <p className="text-sm mb-4">Vul je e-mailadres in. Je ontvangt een link om een nieuw wachtwoord in te stellen.</p>

      <input
        type="email"
        placeholder="E-mailadres"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full p-2 border rounded mb-2"
      />

      <button
        onClick={verstuur}
        className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
      >
        Verstuur resetlink
      </button>

      {status === "success" && (
        <p className="text-green-600 mt-4">✅ Resetlink verzonden. Controleer je e-mail.</p>
      )}
      {status === "notfound" && (
        <p className="text-red-600 mt-4">❌ E-mailadres niet gevonden.</p>
      )}
      {status === "serverfout" && (
        <p className="text-red-600 mt-4">❌ Fout bij versturen van de e-mail.</p>
      )}
    </div>
  );
}
