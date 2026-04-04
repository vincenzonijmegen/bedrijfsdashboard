"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const MAX_LENGTH = 4;

export default function KeukenLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function addDigit(digit: string) {
    if (loading) return;
    if (password.length >= MAX_LENGTH) return;
    setPassword((prev) => prev + digit);
    setError("");
  }

  function removeDigit() {
    if (loading) return;
    setPassword((prev) => prev.slice(0, -1));
    setError("");
  }

  async function handleSubmit(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();

    if (!password) {
      setError("Voer eerst de toegangscode in.");
      return;
    }

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
        setError(data?.error || "Onjuiste code");
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

  function NumberButton({
    value,
    onClick,
  }: {
    value: string;
    onClick: () => void;
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="flex h-20 items-center justify-center rounded-3xl border border-slate-200 bg-white text-3xl font-bold text-slate-900 shadow-sm transition active:scale-95 disabled:opacity-50"
      >
        {value}
      </button>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="mb-6 text-center">
          <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
            Keuken iPad
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900">
            Keuken toegang
          </h1>
          <p className="mt-3 text-slate-600">
            Voer de toegangscode in.
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <div className="mb-2 text-center text-sm font-medium text-slate-700">
              Toegangscode
            </div>

            <div className="flex justify-center gap-3">
              {Array.from({ length: MAX_LENGTH }).map((_, index) => {
                const filled = index < password.length;
                return (
                  <div
                    key={index}
                    className={`h-4 w-4 rounded-full border ${
                      filled
                        ? "border-slate-900 bg-slate-900"
                        : "border-slate-300 bg-white"
                    }`}
                  />
                );
              })}
            </div>
          </div>

          {error ? (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-3">
            <NumberButton value="1" onClick={() => addDigit("1")} />
            <NumberButton value="2" onClick={() => addDigit("2")} />
            <NumberButton value="3" onClick={() => addDigit("3")} />

            <NumberButton value="4" onClick={() => addDigit("4")} />
            <NumberButton value="5" onClick={() => addDigit("5")} />
            <NumberButton value="6" onClick={() => addDigit("6")} />

            <NumberButton value="7" onClick={() => addDigit("7")} />
            <NumberButton value="8" onClick={() => addDigit("8")} />
            <NumberButton value="9" onClick={() => addDigit("9")} />

            <button
              type="button"
              onClick={removeDigit}
              disabled={loading || password.length === 0}
              className="flex h-20 items-center justify-center rounded-3xl border border-slate-200 bg-white text-base font-semibold text-slate-700 shadow-sm transition active:scale-95 disabled:opacity-40"
            >
              Wis
            </button>

            <NumberButton value="0" onClick={() => addDigit("0")} />

            <button
              type="submit"
              disabled={loading || password.length === 0}
              className="flex h-20 items-center justify-center rounded-3xl bg-slate-900 text-base font-semibold text-white shadow-sm transition active:scale-95 disabled:opacity-50"
            >
              {loading ? "..." : "Open"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}