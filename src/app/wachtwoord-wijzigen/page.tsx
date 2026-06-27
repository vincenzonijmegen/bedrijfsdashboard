"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type Gebruiker = {
  naam: string;
  email: string;
  rol?: string;
};

export default function WachtwoordWijzigen() {
  const router = useRouter();

  const [gebruiker, setGebruiker] = useState<Gebruiker | null>(null);
  const [geladen, setGeladen] = useState(false);
  const [wachtwoord, setWachtwoord] = useState("");
  const [herhaal, setHerhaal] = useState("");
  const [fout, setFout] = useState("");
  const [succes, setSucces] = useState("");

  useEffect(() => {
    let actief = true;

    async function haalGebruikerOp() {
      try {
        const res = await fetch("/api/user", {
          method: "GET",
          cache: "no-store",
        });

        if (!res.ok) {
          router.push("/sign-in");
          return;
        }

        const data: Gebruiker = await res.json();

        if (!actief) return;

        setGebruiker(data);
        setGeladen(true);
      } catch {
        router.push("/sign-in");
      }
    }

    haalGebruikerOp();

    return () => {
      actief = false;
    };
  }, [router]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    setFout("");
    setSucces("");

    if (wachtwoord.length < 8) {
      setFout("Wachtwoord moet minstens 8 tekens zijn.");
      return;
    }

    if (wachtwoord !== herhaal) {
      setFout("Wachtwoorden komen niet overeen.");
      return;
    }

    try {
      const res = await fetch("/api/wachtwoord-wijzigen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nieuwWachtwoord: wachtwoord }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setFout(data.error || "Er ging iets mis.");
        return;
      }

      setSucces("Wachtwoord gewijzigd. Je wordt doorgestuurd...");

      const rol = String(gebruiker?.rol || "").toLowerCase();

      setTimeout(() => {
        if (rol === "accountant") {
          router.push("/accountant");
          return;
        }

        router.push("/admin");
      }, 1200);
    } catch (err) {
      console.error(err);
      setFout("Er is iets misgegaan.");
    }
  }

  if (!geladen) {
    return (
      <div className="max-w-sm mx-auto mt-20">
        <p className="text-sm text-gray-600">Bezig met laden...</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-sm mx-auto mt-20 space-y-4">
      <h1 className="text-xl font-semibold">Nieuw wachtwoord instellen</h1>

      <input
        type="email"
        value={gebruiker?.email || ""}
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