"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [naam, setNaam] = useState("");

  useEffect(() => {
    const gebruiker = localStorage.getItem("gebruiker");
    if (!gebruiker) {
      router.push("/sign-in");
      return;
    }

    try {
      const parsed = JSON.parse(gebruiker);
      setNaam(parsed.naam || "");
    } catch {
      localStorage.removeItem("gebruiker");
      router.push("/sign-in");
    }
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <Link href="/" className="text-sm text-blue-600 hover:underline">
        ← Terug naar startpagina
        </Link>

        <button
          onClick={() => {
            localStorage.removeItem("gebruiker");
            router.push("/sign-in");
          }}
          className="text-sm text-red-600 underline"
        >
          Uitloggen
        </button>
      </div>

      <p className="text-sm text-gray-600">Welkom {naam ? naam : "..."}</p>

      <div>{children}</div>
    </div>
  );
}
