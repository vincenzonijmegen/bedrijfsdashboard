import { db } from "@/lib/db";
import StapVoorStapMetToets from "@/components/instructie/StapVoorStapMetToets";
import GelezenRegistratie from "@/components/instructie/GelezenRegistratie";

interface Props {
  params: {
    slug: string;
  };
}

export default async function Page({ params }: Props) {
  const slug = params.slug;
  const result = await db.query(
    "SELECT * FROM instructies WHERE slug = $1",
    [slug]
  );

  const instructie = result.rows[0];

  if (!instructie) {
    return <div className="p-6 text-red-700">❌ Instructie niet gevonden</div>;
  }

  return (
    <>
      <GelezenRegistratie instructie_id={instructie.id} />
      <StapVoorStapMetToets html={instructie.inhoud} />
    </>
  );
}
