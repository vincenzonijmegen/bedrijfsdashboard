import { db } from "@/lib/db";
import StapVoorStapMetToets from "@/components/instructie/StapVoorStapMetToets";

type Props = {
  params: {
    slug: string;
  };
};

// ✅ Dit voorkomt dat Next.js zijn eigen PageProps-type genereert:
export async function generateMetadata({ params }: Props) {
  return {
    title: `Instructie: ${params.slug}`,
  };
}

export default async function Page({ params }: Props) {
  const result = await db.query(
    "SELECT * FROM instructies WHERE slug = $1",
    [params.slug]
  );

  const instructie = result.rows[0];

  if (!instructie) {
    return <div className="p-6 text-red-700">❌ Instructie niet gevonden</div>;
  }

  return <StapVoorStapMetToets html={instructie.inhoud} />;
}
