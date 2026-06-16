import Link from "next/link";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function Page(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;

  const result = await db.query(
    `
    SELECT id, titel, nummer, inhoud
    FROM instructies
    WHERE slug = $1
    LIMIT 1
    `,
    [slug]
  );

  const instructie = result.rows[0];

  if (!instructie) {
    return (
      <main className="min-h-screen bg-slate-50 p-4 md:p-6">
        <div className="mx-auto max-w-4xl">
          <Link href="/winkel/instructies" className="text-slate-600">
            ← Terug naar winkelinstructies
          </Link>

          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-red-700">
            Instructie niet gevonden.
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/winkel/instructies"
          className="mb-6 inline-flex items-center text-slate-600"
        >
          ← Terug naar winkelinstructies
        </Link>

        <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-3xl font-bold text-slate-900">
            {instructie.nummer ? `${instructie.nummer}. ` : ""}
            {instructie.titel}
          </h1>

          <div
            className="prose prose-slate mt-6 max-w-none"
            dangerouslySetInnerHTML={{ __html: instructie.inhoud || "" }}
          />
        </article>
      </div>
    </main>
  );
}