import { db } from "@/lib/db";
import StapVoorStapMetToets from "@/components/instructie/StapVoorStapMetToets";
import GelezenRegistratie from "@/components/instructie/GelezenRegistratie";

export default async function Page(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;

  const result = await db.query(
    "SELECT * FROM instructies WHERE slug = $1",
    [slug]
  );

  const instructie = result.rows[0];

  if (!instructie) {
    return null;
  }

  return (
    <>
      <GelezenRegistratie instructie_id={instructie.id} />
      <StapVoorStapMetToets
        html={instructie.inhoud}
        instructie_id={instructie.id}
        titel={instructie.titel}
        terugHref="/keuken/instructies-skills"
        terugLabel="Terug naar keukeninstructies"
      />
    </>
  );
}