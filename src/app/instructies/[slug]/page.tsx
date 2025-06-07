// src/app/instructies/[slug]/page.tsx
import { db } from "@/lib/db";
import StapVoorStapMetToets from "@/components/Instructie/StapVoorStapMetToets";

export default async function InstructieWeergave({ params }: { params: { slug: string } }) {
  const result = await db.query("SELECT * FROM instructies WHERE slug = $1", [params.slug]);
  const instructie = result.rows[0];

  if (!instructie) {
    return <div className="text-center mt-10">❌ Instructie niet gevonden</div>;
  }

  return <StapVoorStapMetToets html={instructie.inhoud} />;
}
