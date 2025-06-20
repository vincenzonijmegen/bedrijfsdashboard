"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
  const router = useRouter();

  useEffect(() => {
    const gebruiker = localStorage.getItem("gebruiker");
    if (!gebruiker) router.push("/sign-in");
  }, []);

  return (
    <div className="p-6 space-y-6 max-w-xl mx-auto">
      <h1 className="text-3xl font-bold">Beheerscherm</h1>

      <div className="grid gap-4">
        <Link href="/admin/instructies" className="block bg-blue-600 text-white p-4 rounded shadow">
          Instructies beheren
        </Link>
        <Link href="/admin/medewerkers" className="block bg-green-600 text-white p-4 rounded shadow">
          Medewerkers beheren
        </Link>
        <Link href="/admin/resultaten" className="block bg-purple-600 text-white p-4 rounded shadow">
          Testresultaten inzien
        </Link>
        <Link href="/admin/skills" className="block bg-yellow-500 text-white p-4 rounded shadow">
          Skills beheren
        </Link>
        <Link href="/instructies" className="block bg-gray-500 text-white p-4 rounded shadow">
          Bekijk instructies als medewerker
        </Link>
        <Link href="/open-shifts" className="block bg-cyan-600 text-white p-4 rounded shadow">
          Open Shifts PDF
        </Link>
      </div>
    </div>
  );
}
