"use client";
import { useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";

type Instructie = {
  id: string;
  titel: string;
  versie: number;
  gelezen: boolean;
};

export default function DashboardPage() {
  const { user } = useUser();
  const [instructies, setInstructies] = useState<Instructie[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch("/api/instructies");
        const data = await res.json();

        const gelezenSet = new Set<string>(
          JSON.parse(localStorage.getItem("gelezen") || "[]")
        );

        const metStatus = data.map((item: any) => ({
          ...item,
          gelezen: gelezenSet.has(item.id),
        }));

        setInstructies(metStatus);
      } catch (e) {
        console.error("Fout bij ophalen instructies:", e);
      }
    };

    fetchData();
  }, []);

  const markeerAlsGelezen = (id: string) => {
    const nieuw = instructies.map((i) =>
      i.id === id ? { ...i, gelezen: true } : i
    );
    setInstructies(nieuw);

    const gelezenIds = nieuw.filter((i) => i.gelezen).map((i) => i.id);
    localStorage.setItem("gelezen", JSON.stringify(gelezenIds));
  };

  return (
    <main className="p-6">
      <h1 className="text-xl mb-4">
        Instructies voor {user?.fullName || user?.emailAddresses[0].emailAddress}
      </h1>
      <ul className="space-y-3">
        {instructies.map((inst) => (
          <li
            key={inst.id}
            className="p-4 border rounded bg-white shadow flex justify-between items-center"
          >
            <span>{inst.titel}</span>
            {inst.gelezen ? (
              <span className="text-green-600">Gelezen</span>
            ) : (
              <button
                className="text-blue-600 underline"
                onClick={() => markeerAlsGelezen(inst.id)}
              >
                Markeer als gelezen
              </button>
            )}
          </li>
        ))}
      </ul>
    </main>
  );
}
