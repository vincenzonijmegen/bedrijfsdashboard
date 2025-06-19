import { db } from "@/lib/db";
import StapVoorStapMetToets from "@/components/instructie/StapVoorStapMetToets";
import GelezenRegistratie from "@/components/instructie/GelezenRegistratie";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function Page(props: any) {
  const slug = props.params?.slug;

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
/>

    </>
  );
}
