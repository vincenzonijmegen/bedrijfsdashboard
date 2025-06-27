export default function AdminTest() {
  return (
    <div className="p-8 space-y-4">
      <h1 className="text-3xl font-bold text-blue-600">Test: Tailwind werkt</h1>

      <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
        <p className="text-gray-700 mb-4">
          Dit is een testcomponent om te controleren of Tailwind opmaak zichtbaar is in je project.
        </p>
        <button className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
          Klik mij
        </button>
      </div>
    </div>
  );
}
