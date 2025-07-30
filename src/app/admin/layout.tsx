"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ReactNode } from "react";
import { handleLogout } from "@/utils/auth";



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
      if (parsed.functie !== "beheerder") {
        router.push("/instructies");
        return;
      }
      setNaam(parsed.naam || "");
    } catch {
      localStorage.removeItem("gebruiker");
      router.push("/sign-in");
    }
  }, []);

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4">
      <div className="flex justify-between items-center">
      <Link href="/admin" className="inline-flex items-center text-sm text-blue-600 hover:underline gap-1">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        
      </Link>




<button
  onClick={handleLogout}
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
