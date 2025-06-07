// Pagina: /admin/instructies/[slug]/edit.tsx

import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import dynamic from "next/dynamic";
import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { redirect } from "next/navigation";

// Dynamische import zodat Tiptap alleen in de browser laadt
const Editor = dynamic(() => import("@/components/instructie/Editor"), { ssr: false });

export default async function EditInstructie({ params }: { params: { slug: string } }) {
  const result = await db.query("SELECT * FROM instructies WHERE slug = $1", [params.slug]);
  const instructie = result.rows[0];

  if (!instructie) return notFound();

  async function handleSave(formData: FormData) {
    "use server";
    const inhoud = formData.get("inhoud")?.toString() ?? "";
    await db.query("UPDATE instructies SET inhoud = $1 WHERE slug = $2", [inhoud, params.slug]);
    revalidatePath("/instructies/" + params.slug);
    redirect("/instructies/" + params.slug);
  }

  return (
    <form action={handleSave} className="p-4 space-y-4">
      <Editor name="inhoud" defaultContent={instructie.inhoud ?? "<p></p>"} />
      <Button type="submit">Opslaan</Button>
    </form>
  );
}
