"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [fout, setFout] = useState("");

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFout("");

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, wachtwoord }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setFout(data.error || "Inloggen mislukt.");
        return;
      }

      if (data.moetWachtwoordWijzigen) {
        router.push(`/wachtwoord-wijzigen?email=${encodeURIComponent(email)}`);
        return;
      }

      const rol = String(data.rol || "").toLowerCase();

      if (rol === "accountant") {
        router.push("/accountant");
        return;
      }

      if (rol === "beheerder") {
        router.push("/admin");
        return;
      }

      setFout(
        "Deze login is alleen voor beheer. Medewerkers ontvangen werkinstructies per mail."
      );
    } catch {
      setFout("Serverfout bij inloggen.");
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto flex min-h-[70vh] max-w-md items-center">
        <form
          onSubmit={handleLogin}
          className="w-full space-y-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="space-y-2">
            <p className="text-sm font-medium text-blue-700">
              IJssalon Vincenzo
            </p>

            <h1 className="text-2xl font-bold tracking-tight text-slate-900">
              Beheer login
            </h1>

            <p className="text-sm text-slate-600">
              Deze login is alleen bedoeld voor beheerders en accountanttoegang.
              Medewerkers ontvangen werkinstructies via persoonlijke links per
              mail.
            </p>
          </div>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">
              E-mailadres
            </span>

            <input
              type="email"
              placeholder="naam@ijssalonvincenzo.nl"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              required
            />
          </label>

          <label className="block space-y-1">
            <span className="text-sm font-medium text-slate-700">
              Wachtwoord
            </span>

            <input
              type="password"
              placeholder="Wachtwoord"
              value={wachtwoord}
              onChange={(e) => setWachtwoord(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-100"
              required
            />
          </label>

          {fout && (
            <p className="rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              ❌ {fout}
            </p>
          )}

          <button
            type="submit"
            className="w-full rounded-2xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-100"
          >
            Inloggen
          </button>

          <p className="text-center text-sm text-slate-600">
            <a
              href="/wachtwoord-vergeten"
              className="font-medium text-blue-700 hover:underline"
            >
              Wachtwoord vergeten?
            </a>
          </p>
        </form>
      </div>
    </main>
  );
}