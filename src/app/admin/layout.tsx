"use client";

import Link from "next/link";
import { useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { handleLogout } from "@/utils/auth";
import Breadcrumbs from "./_components/Breadcrumbs";

type Gebruiker = {
  naam: string;
  email: string;
  functie?: string;
  rol?: string;
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [naam, setNaam] = useState("");
  const [geladen, setGeladen] = useState(false);

  useEffect(() => {
    let actief = true;

    async function controleerSessie() {
      try {
        const res = await fetch("/api/user", {
          method: "GET",
          cache: "no-store",
        });

        if (!res.ok) {
          router.push("/sign-in");
          return;
        }

        const gebruiker: Gebruiker = await res.json();
        const rol = String(gebruiker.rol || "").toLowerCase();

        if (rol !== "beheerder") {
          router.push("/sign-in");
          return;
        }

        if (!actief) return;

        setNaam(gebruiker.naam || "");
        setGeladen(true);
      } catch {
        router.push("/sign-in");
      }
    }

    controleerSessie();

    return () => {
      actief = false;
    };
  }, [router]);

  const hideOnAdminHome = pathname === "/admin";

  if (!geladen) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <p className="text-sm text-gray-600">Bezig met laden...</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <Link
          href="/admin"
          className="inline-flex items-center text-sm text-blue-600 hover:underline gap-1"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 9.75L12 3l9 6.75v9a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18.75v-9z"
            />
          </svg>
          Start
        </Link>

        <button
          onClick={handleLogout}
          className="text-sm text-red-600 underline"
        >
          Uitloggen
        </button>
      </div>

      <p className="text-sm text-gray-600">Welkom {naam ? naam : "..."}</p>

      {!hideOnAdminHome && <Breadcrumbs />}

      <div>{children}</div>
    </div>
  );
}