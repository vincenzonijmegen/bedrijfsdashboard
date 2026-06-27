"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function RedirectNaarNieuweResetPagina() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");

    if (token) {
      router.replace(`/reset-wachtwoord?token=${encodeURIComponent(token)}`);
      return;
    }

    router.replace("/wachtwoord-vergeten");
  }, [router, searchParams]);

  return (
    <div className="max-w-md mx-auto mt-20 p-4 border bg-white rounded shadow">
      <h1 className="text-xl font-bold mb-2">Doorsturen...</h1>
      <p className="text-sm text-gray-600">
        Je wordt doorgestuurd naar de juiste wachtwoordpagina.
      </p>
    </div>
  );
}

export default function WachtwoordReset() {
  return (
    <Suspense
      fallback={
        <div className="max-w-md mx-auto mt-20 p-4 border bg-white rounded shadow">
          <p className="text-sm text-gray-600">Bezig met laden...</p>
        </div>
      }
    >
      <RedirectNaarNieuweResetPagina />
    </Suspense>
  );
}