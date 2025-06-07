// src/app/instructies/[slug]/page.tsx
import { db } from "@/lib/db";
import StapVoorStapMetToets from "@/components/instructie/StapVoorStapMetToets";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function Page(_: Request, context: any) {
  const { slug } = context.params;
  const result = await db.query("SELECT * FROM instructies WHERE slug = $1", [slug]);
  const instructie = result.rows[0];

  if (!instructie) {
    return <div className="p-6 text-red-700">Instructie niet gevonden</div>;
  }

  return <StapVoorStapMetToets html={instructie.inhoud} />;
}
