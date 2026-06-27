"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import KasboekComponent from "@/components/KasboekComponent";
import { handleLogout } from "@/utils/auth";

type Gebruiker = {
  naam: string;
  email: string;
  functie?: string;
  rol?: string;
};

export default function Page() {
  const router = useRouter();

  const [gebruiker, setGebruiker] = useState<Gebruiker | null>(null);
  const [geladen, setGeladen] = useState(false);
  const [geenToegang, setGeenToegang] = useState(false);

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

        const data: Gebruiker = await res.json();
        const rol = String(data.rol || "").toLowerCase();

        if (rol !== "accountant") {
          if (!actief) return;

          setGeenToegang(true);
          setGeladen(true);
          return;
        }

        if (!actief) return;

        setGebruiker(data);
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

  if (!geladen) {
    return (
      <div className="max-w-5xl mx-auto p-4">
        <p className="text-sm text-gray-600">Bezig met laden...</p>
      </div>
    );
  }

  if (geenToegang || !gebruiker) {
    return (
      <div className="p-8 text-red-700">
        Niet geautoriseerd voor deze pagina.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">
            Welkom, boekhouder/accountant
          </h1>

          <div className="text-sm text-gray-500">
            {gebruiker.naam} ({gebruiker.email})
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="text-red-700 underline text-sm ml-6"
        >
          Uitloggen
        </button>
      </div>

      <KasboekComponent alleenLezen={true} />
    </div>
  );
}