import { db } from "@/lib/db";

export default async function ResultatenOverzicht() {
  const result = await db.query("SELECT * FROM toetsresultaten ORDER BY tijdstip DESC");
  const rows = result.rows;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">📊 Toetsresultaten</h1>
      <table className="w-full text-sm border-collapse border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">E-mail</th>
            <th className="border p-2">Score</th>
            <th className="border p-2">Goed / Totaal</th>
            <th className="border p-2">Slug</th>
            <th className="border p-2">Tijdstip</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any, i: number) => (
            <tr key={i}>
              <td className="border p-2">{r.email}</td>
              <td className="border p-2 text-center">{r.score}%</td>
              <td className="border p-2 text-center">{r.juist} / {r.totaal}</td>
              <td className="border p-2">{r.slug}</td>
              <td className="border p-2">{new Date(r.tijdstip).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
