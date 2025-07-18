"use client";

import { useState, useEffect } from "react";

interface Productie {
  id: number;
  smaak: string;
  datum: string;
  aantal: number;
  kleur: string;
}

export default function SuikervrijPage() {
  const [bewerken, setBewerken] = useState<Productie | null>(null);
  const [lijst, setLijst] = useState<Productie[]>([]);
  const [smakenlijst, setSmakenlijst] = useState<string[]>([]);
  const [kleurenlijst, setKleurenlijst] = useState<{ naam: string; hexcode: string }[]>([]);
  const [smaak, setSmaak] = useState("");
  const [datum, setDatum] = useState(() => new Date().toISOString().substring(0, 10));
  const [aantal, setAantal] = useState(0);
  const [kleur, setKleur] = useState("");
  const [nieuweSmaak, setNieuweSmaak] = useState("");
  const [nieuweKleur, setNieuweKleur] = useState("");

  useEffect(() => {
    // Fetch initial data
    fetch("/api/suikervrij/productie")
      .then((res) => res.json())
      .then((data) => setLijst(data));
    fetch("/api/suikervrij/smaken")
      .then((res) => res.json())
      .then((data) => {
        const namen = data.map((d: any) => d.naam);
        setSmakenlijst(namen);
        if (!smaak) setSmaak(namen[0] || "");
      });
    fetch("/api/suikervrij/kleuren")
      .then((res) => res.json())
      .then((data) => {
        setKleurenlijst(data);
        if (!kleur) setKleur(data[0]?.naam || "");
      });
  }, []);

  const toevoegen = async () => {
    if (!aantal || aantal <= 0) return;
    const res = await fetch("/api/suikervrij/productie", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ smaak, datum, aantal, kleur }),
    });
    const nieuw = await res.json();
    setLijst((prev) => [nieuw, ...prev]);
    setAantal(0);
  };

  const voegSmaakToe = async () => {
    if (!nieuweSmaak.trim()) return;
    await fetch("/api/suikervrij/smaken", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ naam: nieuweSmaak.trim() }),
    });
    setNieuweSmaak("");
    const data = await fetch("/api/suikervrij/smaken").then((res) => res.json());
    setSmakenlijst(data.map((d: any) => d.naam));
  };

  const voegKleurToe = async () => {
    if (!nieuweKleur.trim()) return;
    await fetch("/api/suikervrij/kleuren", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ naam: nieuweKleur.trim() }),
    });
    setNieuweKleur("");
    const data = await fetch("/api/suikervrij/kleuren").then((res) => res.json());
    setKleurenlijst(data);
  };

  return (
    <div className="p-6">
      {/* Global print styles */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; top: 0; left: 0; width: 100%; padding: 2rem; }
          .no-print { display: none; }
        }
      `}</style>
                            setLijst((prev) => prev.filter((item) => item.id !== p.id));
                          }
                        }}
                      >
                        🗑️
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}

      {/* Printvoorbeeld laatste 2 producties per smaak */}
      <div className="mt-10 print:bg-white print:p-6 print:visible">
        <h2 className="text-lg font-bold mb-4">Printvoorbeeld – laatste 2 producties per smaak</h2>
        {smakenlijst.map((smaakNaam) => {
          const items = lijst
            .filter((item) => item.smaak === smaakNaam)
            .sort((a, b) => new Date(b.datum).getTime() - new Date(a.datum).getTime())
            .slice(0, 2);

          if (items.length === 0) return null;

          return (
            <div key={smaakNaam} className="mb-4">
              <h3 className="font-semibold mb-1">{smaakNaam}</h3>
              <ul className="text-sm pl-4 list-disc">
                {items.map((p) => (
                  <li key={p.id}>
                    {new Date(p.datum).toLocaleDateString("nl-NL")}, {p.aantal} stuks, kleur: {p.kleur}
                    <span
                      className="inline-block w-3 h-3 ml-2 rounded-full align-middle"
                      style={{ backgroundColor: kleurenlijst.find((k) => k.naam === p.kleur)?.hexcode || "#ccc" }}
                    ></span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Bewerken modal */}
      {bewerken && (
        <div className="fixed inset-0 bg-black bg-opacidade-50 flex items-center justify-center z-50">        
          <div className="bg-white p-6 rounded shadow-lg w-full max-w-lg">
            <h2 className="text-lg font-semibold mb-4">Productie bewerken</h2>
            <div className="space-y-4">
              <label className="block">
                Datum
                <input
                  type="date"
                  className="w-full border rounded p-2"
                  value={bewerken.datum}
                  onChange={(e) => setBewerken({ ...bewerken, datum: e.target.value })}
                />
              </label>
              <label className="block">
                Aantal
                <input
                  type="number"
                  className="w-full border rounded p-2"
                  value={bewerken.aantal}
                  onChange={(e) => setBewerken({ ...bewerken, aantal: parseInt(e.target.value) || 0 })}
                />
              </label>
              <label className="block">
                Stickerkleur
                <select
                  className="w-full border rounded p-2"
                  value={bewerken.kleur}
                  onChange={(e) => setBewerken({ ...bewerken, kleur: e.target.value })}
                >
                  {kleurenlijst.map((k) => (
                    <option key={k.naam} value={k.naam}>{k.naam}</option>
                  ))}
                </select>
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setBewerken(null)}
                  className="text-gray-600"
                >
                  Annuleer
                </button>
                <button
                  className="bg-blue-600 text-white px-4 py-1 rounded"
                  onClick={async () => {
                    await fetch("/api/suikervrij/productie", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(bewerken),
                    });
                    const res = await fetch("/api/suikervrij/productie");
                    const data = await res.json();
                    setLijst(data);
                    setBewerken(null);
                  }}
                >
                  Opslaan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
