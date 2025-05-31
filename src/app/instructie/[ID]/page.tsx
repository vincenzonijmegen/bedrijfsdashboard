import { notFound } from "next/navigation";
import { query } from "@/lib/db";
import Linkify from "linkify-react";

type PageProps = {
  params: { id: string };
  searchParams?: { [key: string]: string | string[] | undefined };
};


export default async function InstructieDetail({ params }: PageProps) {
  const result = await query("SELECT * FROM instructies WHERE id = $1", [params.id]);
  const instructie = result.rows[0];

  if (!instructie) return notFound();

  const inhoud = instructie.inhoud || "";

  const linkifyOptions = {
    target: "_blank",
    className: "text-blue-600 underline",
  };

  const youtubeEmbed = inhoud.includes("youtube.com")
    ? inhoud.match(/https:\/\/www\.youtube\.com\/watch\?v=([^\s]+)/)?.[1]
    : null;

  return (
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">{instructie.titel}</h1>

      <div className="prose whitespace-pre-wrap mb-6">
        <Linkify options={linkifyOptions}>{inhoud}</Linkify>
      </div>

      {youtubeEmbed && (
        <iframe
          className="w-full aspect-video rounded shadow"
          src={`https://www.youtube.com/embed/${youtubeEmbed}`}
          allowFullScreen
        />
      )}

      <a
        href="/dashboard"
        className="inline-block mt-6 text-sm text-blue-600 hover:underline"
      >
        ← Terug naar instructieoverzicht
      </a>
    </main>
  );
}
