// src/app/admin/medewerker/[email]/page.tsx
export default function MedewerkerDetail({ params }: { params: { email: string } }) {
  return (
    <main className="p-6">
      <h1 className="text-xl">Medewerker {params.email}</h1>
      <p>Detailpagina volgt nog…</p>
    </main>
  );
}
