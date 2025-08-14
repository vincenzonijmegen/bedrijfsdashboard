"use client";

import { SWRConfig } from "swr";
import React from "react";

async function defaultFetcher(url: string) {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Fetch ${url} failed: ${res.status} ${text}`);
  }
  return res.json();
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        fetcher: defaultFetcher,
        // minder onnodige refetches bij focus/reconnect
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
        // requests binnen dit interval worden gede‑duped
        dedupingInterval: 15000,
        // fout logging (optioneel)
        onError: (err, key) => {
          if (process.env.NODE_ENV !== "production") {
            console.error("[SWR error]", key, err);
          }
        },
      }}
    >
      {children}
    </SWRConfig>
  );
}
