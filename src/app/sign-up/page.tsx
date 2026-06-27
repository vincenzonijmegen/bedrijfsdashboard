"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignUpPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/sign-in");
  }, [router]);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">
          Account aanmaken niet nodig
        </h1>

        <p className="mt-3 text-sm text-slate-600">
          Medewerkers ontvangen werkinstructies via persoonlijke links per mail.
          Beheer en accountant kunnen inloggen via de beheerlogin.
        </p>

        <p className="mt-4 text-sm text-slate-500">
          Je wordt doorgestuurd naar de loginpagina...
        </p>
      </div>
    </main>
  );
}