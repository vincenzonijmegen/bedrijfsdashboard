"use client";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function ResetWachtwoord() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");

  const [wachtwoord, setWachtwoord] = useState("");
  const [herhaal, setHerhaal] = useState("");
  const [fout, setFout] = useState("");
  const [succes, setSucces] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const t = url.searchParams.get("token");
      if (t) setToken(t);
    }
  }, []);

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

    if (data.success && data.email) {
      // automatisch inloggen
      const loginRes = await fetch("/api/login", {
        method: "POST",
        body: JSON.stringify({ email: data.email, wachtwoord }),
      });

      const loginData = await loginRes.json();
      if (loginData.success) {
        localStorage.setItem("gebruiker", JSON.stringify(loginData));

        if (loginData.functie === "beheerder") {
          router.push("/admin");
        } else {
          router.push("/instructies");
        }
        return;
      }
    }

    if (!data.success) {
      setFout(data.error || "Ongeldige of verlopen link.");
    } else {
      setFout("Wachtwoord is gewijzigd, maar automatisch inloggen is mislukt.");
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
