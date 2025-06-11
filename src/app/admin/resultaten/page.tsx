import { db } from "@/lib/db";

export default async function ResultatenOverzicht() {
  const result = await db.query("SELECT * FROM toetsresultaten ORDER BY tijdstip DESC");
  const rows: {
    email: string;
    score: number;
    juist: number;
    totaal: number;
    slug: string;
    tijdstip: string;
  }[] = result.rows;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold flex items-center gap-2">📊 Toetsresultaten</h1>
      <table className="w-full text-sm border-collapse border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">E-mail</th>
            <th className="border p-2 text-center">Score</th>
            <th className="border p-2 text-center">Goed / Totaal</th>
            <th className="border p-2 text-center">Slug</th>
            <th className="border p-2 text-center">Tijdstip</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="border p-2">{r.email}</td>
              <td className="border p-2 text-center">{r.score}%</td>
              <td className="border p-2 text-center">
                {r.juist} / {r.totaal}
              </td>
              <td className="border p-2 text-center">{r.slug}</td>
              <td className="border p-2 text-center">
                {new Date(r.tijdstip).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
