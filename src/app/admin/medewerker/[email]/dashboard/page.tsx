import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import DashboardWrapper from "@/components/medewerker/DashboardWrapper";

// async logica in loader-functie, NIET in de default export
async function getMedewerker(email: string) {
  const { rows } = await db.query(
    `SELECT id, naam, functie FROM medewerkers WHERE email = $1`,
    [email]
  );
  return rows?.[0];
}

// ⛔️ GEEN async hier
export default function AdminMedewerkerDashboard({
  params,
}: {
  params: { email: string };
}) {
  const email = decodeURIComponent(params.email);

  // Return placeholder + loader
  return <DashboardShell email={email} />;
}

// 👇 Async loader losgekoppeld van default export
async function DashboardShell({ email }: { email: string }) {
  const medewerker = await getMedewerker(email);
  if (!medewerker) return notFound();

  return (
    <main className="p-6">
      <div className="mb-4">
        <p className="text-sm text-gray-500">
          👀 Je bekijkt het dashboard van <strong>{medewerker.naam}</strong> in readonly-modus.
        </p>
      </div>

      <DashboardWrapper
        email={email}
        functie={medewerker.functie}
        naam={medewerker.naam}
        readonly={true}
      />
    </main>
  );
}
