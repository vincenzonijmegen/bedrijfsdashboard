"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function KeukenLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/keuken/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data?.error || "Onjuist wachtwoord");
        return;
      }

      router.push("/keuken");
      router.refresh();
    } catch (error) {
      console.error(error);
      setError("Inloggen mislukt");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="mb-6">
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Keuken iPad
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Keuken toegang
          </h1>
          <p className="mt-3 text-slate-600">
            Voer het keukenwachtwoord in om de keukenomgeving te openen.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="password"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Wachtwoord
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Keukenwachtwoord"
              autoFocus
              className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-lg outline-none focus:border-slate-500"
            />
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-lg font-semibold text-white disabled:opacity-60"
          >
            {loading ? "Bezig..." : "Open keuken"}
          </button>
        </form>
      </div>
    </main>
  );
}