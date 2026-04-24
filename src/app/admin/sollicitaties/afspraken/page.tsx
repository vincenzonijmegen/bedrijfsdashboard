"use client";

import * as React from "react";

export default function AfsprakenPage() {
  const [loading, setLoading] = React.useState(false);

  return (
    <main className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Sollicitatiegesprekken</h1>

      <button
        type="button"
        disabled={loading}
        onClick={async () => {
          setLoading(true);

          try {
            const res = await fetch("/api/calendly/sync", {
              method: "POST",
            });

            if (!res.ok) {
              alert("Synchroniseren mislukt");
              return;
            }

            alert("Afspraken gesynchroniseerd");
            location.reload();
          } finally {
            setLoading(false);
          }
        }}
        className="mb-4 px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
      >
        {loading ? "Bezig..." : "🔄 Afspraken verversen"}
      </button>
    </main>
  );
}