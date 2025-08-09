'use client';

import KasboekComponent from '@/components/KasboekComponent';

export default function Page() {
  // Gebruiker ophalen uit localStorage (of context, afhankelijk van je setup)
  let user = null;
  if (typeof window !== "undefined") {
    try {
      user = JSON.parse(localStorage.getItem("gebruiker") || "null");
    } catch {
      user = null;
    }
  }

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem("gebruiker");
      window.location.href = "/login"; // of /, afhankelijk van je flow
    }
  };

  // Autorisatiecheck (optioneel, maar wel veilig)
  if (!user || user.rol !== "accountant") {
    return <div className="p-8 text-red-700">Niet geautoriseerd voor deze pagina.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1">Welkom, boekhouder/accountant</h1>
          <div className="text-sm text-gray-500">
            {user.naam} ({user.email})
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
