// src/app/admin/medewerker/[email]/page.tsx
// @ts-nocheck

export default function Page({ params }: { params: { email: string } }) {
  return (
    <main className="p-6">
      <h1 className="text-xl">Medewerker {params.email}</h1>
      <p>Detailpagina volgt nog…</p>
    </main>
  );
}
