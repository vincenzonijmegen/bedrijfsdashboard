"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function ResetWachtwoord() {
  const router = useRouter();

  const [token, setToken] = useState<string>("");
  const [wachtwoord, setWachtwoord] = useState<string>("");
  const [herhaal, setHerhaal] = useState<string>("");
  const [fout, setFout] = useState<string>("");
  const [succes, setSucces] = useState<string>("");

  useEffect(() => {
    const url = new URL(window.location.href);
    const t = url.searchParams.get("token");

    if (t) {
      setToken(t);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    setFout("");
    setSucces("");

    if (wachtwoord.length < 8) {
      setFout("Wachtwoord moet minstens 6 tekens zijn.");
      return;
    }

    if (wachtwoord !== herhaal) {
      setFout("Wachtwoorden komen niet overeen.");
      return;
    }

    try {
      const res = await fetch("/api/reset-wachtwoord", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, nieuwWachtwoord: wachtwoord }),
      });

      const data = await res.json();

      if (!data.success || !data.email) {
        setFout(data.error || "Ongeldige of verlopen link.");
        return;
      }

      const loginRes = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email, wachtwoord }),
      });

      const loginData = await loginRes.json();

      if (!loginRes.ok || !loginData.success) {
        setSucces("Wachtwoord is gewijzigd.");
        setFout("Automatisch inloggen is mislukt. Log opnieuw in.");
        return;
      }

      const rol = String(loginData.rol || "").toLowerCase();

      if (rol === "beheerder") {
        router.push("/admin");
        return;
      }

      if (rol === "accountant") {
        router.push("/accountant");
        return;
      }

      setSucces("Wachtwoord is gewijzigd.");
      router.push("/sign-in");
    } catch (err) {
      console.error(err);
      setFout("Er is iets misgegaan.");
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
        required
      />

      <input
        type="password"
        placeholder="Herhaal wachtwoord"
        className="w-full p-2 border rounded"
        value={herhaal}
        onChange={(e) => setHerhaal(e.target.value)}
        required
      />

      {fout && <p className="text-red-600">{fout}</p>}
      {succes && <p className="text-green-600">{succes}</p>}

      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
        Opslaan
      </button>
    </form>
  );
}