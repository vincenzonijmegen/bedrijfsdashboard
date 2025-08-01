"use client";


import { useEffect, useState } from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

interface Loonkosten {
  jaar: number;
  maand: number;
  lonen: number;
  loonheffing: number;
  pensioenpremie: number;
}

export default function LoonkostenBeheerPage() {
  const [data, setData] = useState<Loonkosten[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/rapportage/loonkosten")
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
      });
  }, []);

  const maanden = Array.from({ length: 12 }, (_, i) => i + 1);
  const jaar = new Date().getFullYear();

  const getValue = (maand: number, veld: keyof Loonkosten) =>
    data.find((r) => r.jaar === jaar && r.maand === maand)?.[veld] ?? 0;

  const updateField = (maand: number, veld: keyof Loonkosten, waarde: number) => {
    setData((prev) => {
      const bestaand = prev.find((r) => r.jaar === jaar && r.maand === maand);
      if (bestaand) {
        return prev.map((r) =>
          r.jaar === jaar && r.maand === maand ? { ...r, [veld]: waarde } : r
        );
      } else {
        return [...prev, { jaar, maand, lonen: 0, loonheffing: 0, pensioenpremie: 0, [veld]: waarde }];
      }
    });
  };

  const opslaan = async (maand: number) => {
    const record = data.find((r) => r.jaar === jaar && r.maand === maand);
    if (!record) return;

    await fetch("/api/rapportage/loonkosten", {
      method: "POST",
      body: JSON.stringify(record),
      headers: {
        "Content-Type": "application/json",
      },
    });
    alert("Opgeslagen!");
  };

  if (loading) return <div>Bezig met laden...</div>;

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Loonkosten {jaar}</h1>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-gray-200 text-left">
            <th className="p-2">Maand</th>
            <th className="p-2">Lonen (€)</th>
            <th className="p-2">Loonheffing (€)</th>
            <th className="p-2">Pensioenpremie (€)</th>
            <th className="p-2">Totaal</th>
            <th className="p-2"></th>
          </tr>
        </thead>
        <tbody>
          {maanden.map((maand) => {
            const lonen = getValue(maand, "lonen");
            const loonheffing = getValue(maand, "loonheffing");
            const pensioen = getValue(maand, "pensioenpremie");
            const totaal = lonen + loonheffing + pensioen;

            return (
              <tr key={maand} className="border-t">
                <td className="p-2">
                  {format(new Date(jaar, maand - 1, 1), "MMMM", { locale: nl })}
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    value={lonen}
                    className="border rounded px-2 py-1 w-28"
                    onChange={(e) =>
                      updateField(maand, "lonen", parseFloat(e.target.value) || 0)
                    }
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    value={loonheffing}
                    className="border rounded px-2 py-1 w-28"
                    onChange={(e) =>
                      updateField(maand, "loonheffing", parseFloat(e.target.value) || 0)
                    }
                  />
                </td>
                <td className="p-2">
                  <input
                    type="number"
                    value={pensioen}
                    className="border rounded px-2 py-1 w-28"
                    onChange={(e) =>
                      updateField(maand, "pensioenpremie", parseFloat(e.target.value) || 0)
                    }
                  />
                </td>
                <td className="p-2 font-semibold">€ {totaal.toFixed(2)}</td>
                <td className="p-2">
                  <button
                    onClick={() => opslaan(maand)}
                    className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                  >
                    Opslaan
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
