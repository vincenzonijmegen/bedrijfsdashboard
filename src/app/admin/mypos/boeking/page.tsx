"use client";
import { useEffect, useState } from "react";

type Boekingsregel = {
  rekening: string | null;
  omschrijving: string;
  bedrag: number;
};

export default function BoekingsdocumentPage() {
  const [maand, setMaand] = useState<string>(() => {
    const nu = new Date();
    return `${nu.getFullYear()}-${String(nu.getMonth() + 1).padStart(2, "0")}`;
  });
  const [regels, setRegels] = useState<Boekingsregel[]>([]);
  const [saldo, setSaldo] = useState<number | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const fetchBoeking = async () => {
    setLoading(true);
    const res = await fetch(`/api/mypos/boeking?maand=${maand}`);
    const data = await res.json();
    if (data?.regels) {
      setRegels(data.regels);
      setSaldo(data.saldo);
    } else {
      setRegels([]);
      setSaldo(null);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchBoeking();
  }, [maand]);

  return (
    <div className="p-6 max-w-full">
      <p className="mb-4">
        <a href="/admin/rapportage/financieel" className="text-sm underline text-blue-600">← Financiële Rapportages</a>
      </p>
      <h1 className="text-2xl font-bold mb-4">MyPOS boekingsdocument Snelstart</h1>

      <label className="block mb-4">
        Kies maand:
        <input
          type="month"
          value={maand}
          onChange={(e) => setMaand(e.target.value)}
          className="ml-2 px-2 py-1 border rounded"
        />
      </label>

      {loading ? (
        <p>Bezig met laden...</p>
      ) : (
        <table className="w-full border border-gray-300 mt-4 text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-1 text-left w-24">Rekening</th>
              <th className="border px-2 py-1 text-left">Omschrijving</th>
              <th className="border px-2 py-1 text-right w-32">Bedrag</th>
            </tr>
          </thead>
          <tbody>
            {regels.map((r, i) => (
              <tr key={i}>
                <td className="border px-2 py-1">{r.rekening ?? ""}</td>
                <td className="border px-2 py-1">{r.omschrijving}</td>
                <td className="border px-2 py-1 text-right">
                  € {r.bedrag.toLocaleString("nl-NL", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
            ))}
            {saldo !== null && (
              <tr className="font-bold bg-gray-100">
                <td className="border px-2 py-1"></td>
                <td className="border px-2 py-1">SALDO</td>
                <td className="border px-2 py-1 text-right">
                  € {saldo.toLocaleString("nl-NL", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}
