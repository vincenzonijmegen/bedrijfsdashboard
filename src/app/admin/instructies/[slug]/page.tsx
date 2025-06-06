// src/app/admin/instructies/[slug]/page.tsx

import type { PageProps } from "next";

export default async function InstructieBewerkPagina({ params }: PageProps) {
  const { slug } = params;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-2">Instructie: {slug}</h1>
      <p>Hier komt straks de editor voor deze instructie.</p>
    </div>
  );
}
