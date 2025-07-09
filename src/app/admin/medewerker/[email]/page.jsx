export default function Page({ params }) {
  return (
    <main className="p-6">
      <h1 className="text-xl">Medewerker {params.email}</h1>
      <p>Detailpagina volgt nog…</p>
    </main>
  );
}
