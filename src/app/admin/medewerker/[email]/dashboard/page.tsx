import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import DashboardWrapper from "@/components/medewerker/DashboardWrapper";

export const dynamic = "force-dynamic"; // zorgt voor juiste runtime bij Vercel

function AdminMedewerkerDashboardPage({ params }: { params: { email: string } }) {
  return <DashboardLoader email={decodeURIComponent(params.email)} />;
}

async function DashboardLoader({ email }: { email: string }) {
  const { rows } = await db.query(
    `SELECT id, naam, functie FROM medewerkers WHERE email = $1`,
    [email]
  );

  const medewerker = rows?.[0];
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

export default AdminMedewerkerDashboardPage;
