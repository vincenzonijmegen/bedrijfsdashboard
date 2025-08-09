'use client';

import KasboekPage from '../admin/kasboek/page'; // pas pad aan als nodig

// Simpele manier: gebruiker wordt via een prop/context/global opgehaald
export default function AccountantDashboard() {
  // Pas deze lijn aan naar jouw user-ophaalpatroon:
  const user = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('user') || '{}') : {};

  if (!user || user.rol !== 'accountant') {
    return (
      <div className="p-8 text-red-700 font-bold">
        Je bent niet geautoriseerd voor deze pagina.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Accountant Dashboard</h1>
      {/* Alleen kasboek, read-only */}
      <KasboekPage alleenLezen />
    </div>
  );
}
