"use client";

import Link from "next/link";
import { useEffect, useState, ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { handleLogout } from "@/utils/auth";
import Breadcrumbs from "./_components/Breadcrumbs"; // ⬅️ toegevoegd

export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [naam, setNaam] = useState("");

  useEffect(() => {
    const gebruiker = localStorage.getItem("gebruiker");
    if (!gebruiker) {
      router.push("/sign-in");
      return;
    }
    try {
      const parsed = JSON.parse(gebruiker);
      if (parsed.functie !== "beheerder") {
        router.push("/instructies");
        return;
      }
      setNaam(parsed.naam || "");
    } catch {
      localStorage.removeItem("gebruiker");
      router.push("/sign-in");
    }
  }, [router]);

  // Wil je geen breadcrumb op de admin-home? Zet dit op true:
  const hideOnAdminHome = pathname === "/admin";

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
        <Link href="/admin" className="inline-flex items-center text-sm text-blue-600 hover:underline gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 9.75L12 3l9 6.75v9a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18.75v-9z" />
          </svg>
          Start
        </Link>

        <button onClick={handleLogout} className="text-sm text-red-600 underline">
          Uitloggen
        </button>
      </div>

      <p className="text-sm text-gray-600">Welkom {naam ? naam : "..."}</p>

      {/* Breadcrumbs tonen, behalve op /admin als je dat mooier vindt */}
      {!hideOnAdminHome && <Breadcrumbs />}

      <div>{children}</div>
    </div>
  );
}
