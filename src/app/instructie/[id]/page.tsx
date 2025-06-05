import { query } from "@/lib/db";
import Linkify from "linkify-react";
import { notFound } from "next/navigation";

interface PageProps {
  params: {
    id: string;
  };
}

export default async function Page({ params }: PageProps) {
  const result = await query("SELECT * FROM instructies WHERE id = $1", [params.id]);
  const instructie = result.rows[0];

  if (!instructie) return notFound();

  const linkifyOptions = {
    target: "_blank",
    className: "text-blue-600 underline",
  };

  const youtubeEmbed = instructie.inhoud?.match(/youtube\.com\/watch\?v=([^\s]+)/)?.[1];

  return (
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">{instructie.titel}</h1>

      <div className="prose whitespace-pre-wrap mb-6">
        <Linkify options={linkifyOptions}>{instructie.inhoud}</Linkify>
      </div>

      {youtubeEmbed && (
        <iframe
          className="w-full aspect-video rounded shadow"
          src={`https://www.youtube.com/embed/${youtubeEmbed}`}
          allowFullScreen
        />
      )}

      <a href="/dashboard" className="text-blue-600 underline text-sm">
        ← Terug naar instructieoverzicht
      </a>
    </main>
  );
}
