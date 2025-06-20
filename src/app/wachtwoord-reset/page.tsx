export default function WachtwoordResetFallback() {
  return (
    <div className="max-w-md mx-auto mt-20 p-4 text-center">
      <h1 className="text-xl font-bold">❌ Ongeldige of verlopen resetlink</h1>
      <p className="text-sm mt-2 text-gray-600">
        Deze pagina verwacht een geldige token in de URL.
      </p>
    </div>
  );
}
