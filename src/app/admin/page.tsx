// ✅ app/admin/page.tsx
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@clerk/nextjs";

export default function AdminDashboard() {
  const { sessionClaims } = auth();
  const email = sessionClaims?.email as string;
  const isAdmin = email === "herman@ijssalonvincenzo.nl";

  if (!isAdmin) redirect("/instructies");

  return (
    <div className="p-6 space-y-6 max-w-xl mx-auto">
      <h1 className="text-3xl font-bold">Beheerscherm</h1>
      <p className="text-gray-600">Welkom, {email}</p>

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
        <Link href="/instructies" className="block bg-gray-500 text-white p-4 rounded shadow">
          Bekijk instructies als medewerker
        </Link>
      </div>
    </div>
  );
}
