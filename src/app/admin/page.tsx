import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function AdminHome() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/sign-in");

  return (
    <main className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex justify-between items-center mb-6">
        <Link href="/" className="text-sm text-blue-600 underline">
          ← Terug naar startpagina
        </Link>
        <Link href="/logout" className="text-sm text-red-600">
          Uitloggen
        </Link>
      </div>

      <p className="text-sm text-gray-600 mb-2">
        Welkom {session.user?.name}
      </p>

      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
        <span role="img">📁</span> Management Portaal
      </h1>

      <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <span role="img">👥</span> Personeel
      </h2>
      <div className="flex flex-wrap gap-4 mb-6">
        <Link href="/admin/medewerkers">
          <Button className="bg-purple-100 text-purple-900 hover:bg-purple-200">
            Medewerkers beheren
          </Button>
        </Link>
        <Link href="/admin/instructies">
          <Button className="bg-pink-100 text-pink-900 hover:bg-pink-200">
            Instructies medewerkers
          </Button>
        </Link>
        <Link href="/admin/sollicitaties">
          <Button className="bg-rose-100 text-rose-900 hover:bg-rose-200">
            Sollicitatiemails
          </Button>
        </Link>
        <Link href="/admin/skills">
          <Button className="bg-emerald-100 text-emerald-900 hover:bg-emerald-200">
            Skills Overzicht
          </Button>
        </Link>
      </div>

      <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <span role="img">📅</span> Planning
      </h2>
      <div className="flex flex-wrap gap-4 mb-6">
        <Link href="/openshifts">
          <Button className="bg-sky-100 text-sky-900 hover:bg-sky-200">
            Open Shifts PDF
          </Button>
        </Link>
        <Link href="/admin/shiftacties">
          <Button className="bg-sky-100 text-sky-900 hover:bg-sky-200">
            Shiftacties & Statistieken
          </Button>
        </Link>
      </div>

      <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <span role="img">📦</span> Voorraadbeheer
      </h2>
      <div className="flex flex-wrap gap-4 mb-6">
        <Link href="/admin/voorraad/artikelen">
          <Button className="bg-orange-100 text-orange-900 hover:bg-orange-200">
            Artikelen beheren
          </Button>
        </Link>
        <Link href="/admin/voorraad">
          <Button className="bg-orange-100 text-orange-900 hover:bg-orange-200">
            Bestel-app
          </Button>
        </Link>
      </div>

      <h2 className="text-lg font-semibold mb-2 flex items-center gap-2">
        <span role="img">📊</span> Rapportages (binnenkort)
      </h2>
      <div className="flex flex-wrap gap-4 mb-6">
        <Link href="/admin/omzet">
          <Button className="bg-indigo-100 text-indigo-900 hover:bg-indigo-200">
            Omzet & voorraad
          </Button>
        </Link>
      </div>
    </main>
  );
}
