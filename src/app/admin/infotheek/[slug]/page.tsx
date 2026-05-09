"use client";

import Link from "next/link";
import useSWR from "swr";
import { useMemo } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Folder,
  Tag,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

type Artikel = {
  id: number;
  slug: string;
  titel: string;
  categorie: string;
  samenvatting: string | null;
  inhoud: string;
  zoekwoorden: string[] | null;
  doelgroep: string | null;
  laatst_bijgewerkt_op: string;
  laatst_bijgewerkt_door?: string | null;
};

function stripHtml(value: string) {
  return value.replace(/<[^>]*>/g, "").trim();
}

function extractToc(html: string) {
  const matches = [...html.matchAll(/<h([23])[^>]*>(.*?)<\/h[23]>/gi)];

  return matches.map((match, index) => ({
    id: `kop-${index}`,
    level: Number(match[1]),
    text: stripHtml(match[2]),
  }));
}

function addHeadingIds(html: string) {
  let index = 0;

  return html.replace(
    /<h([23])([^>]*)>(.*?)<\/h[23]>/gi,
    (full, level, attrs, content) => {
      const id = `kop-${index}`;
      index += 1;

      if (String(attrs).includes("id=")) return full;

      return `<h${level}${attrs} id="${id}">${content}</h${level}>`;
    }
  );
}

export default function InfotheekDetailPage() {
  const params = useParams();
  const slug = String(params?.slug || "");

  const { data, error } = useSWR(
    slug ? `/api/infotheek/${encodeURIComponent(slug)}` : null,
    fetcher
  );

  const artikel: Artikel | null = data?.artikel || null;

  const toc = useMemo(() => {
    if (!artikel?.inhoud) return [];
    return extractToc(artikel.inhoud);
  }, [artikel?.inhoud]);

  const inhoudMetIds = useMemo(() => {
    if (!artikel?.inhoud) return "";
    return addHeadingIds(artikel.inhoud);
  }, [artikel?.inhoud]);

  if (error) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8">
        <div className="mx-auto max-w-4xl rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700 shadow-sm">
          Fout bij laden van dit artikel.
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-sm">
          Artikel laden...
        </div>
      </main>
    );
  }

  if (!artikel) {
    return (
      <main className="min-h-screen bg-slate-100 px-4 py-8">
        <div className="mx-auto max-w-4xl rounded-2xl bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-600">Artikel niet gevonden.</p>

          <Link
            href="/admin/infotheek"
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <ArrowLeft className="h-4 w-4" />
            Terug naar Infotheek
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <Link
          href="/admin/infotheek"
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Terug naar Infotheek
        </Link>

        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-6 border-b border-slate-200 pb-6">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-blue-700">
                <BookOpen className="h-4 w-4" />
                Infotheek
              </div>

              <h1 className="text-3xl font-bold tracking-tight text-slate-950">
                {artikel.titel}
              </h1>

              {artikel.samenvatting && (
                <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
                  {artikel.samenvatting}
                </p>
              )}

              <div className="mt-5 flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-3 py-1 font-semibold text-blue-700 ring-1 ring-blue-100">
                  <Folder className="h-3 w-3" />
                  {artikel.categorie}
                </span>

                <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-3 py-1 font-semibold text-slate-600 ring-1 ring-slate-200">
                  <CalendarDays className="h-3 w-3" />
                  Bijgewerkt:{" "}
                  {new Date(artikel.laatst_bijgewerkt_op).toLocaleDateString(
                    "nl-NL"
                  )}
                </span>

                {artikel.laatst_bijgewerkt_door && (
                  <span className="inline-flex rounded-full bg-slate-50 px-3 py-1 font-semibold text-slate-600 ring-1 ring-slate-200">
                    Door: {artikel.laatst_bijgewerkt_door}
                  </span>
                )}
              </div>
            </div>

            <div
              className="prose prose-slate max-w-none prose-headings:scroll-mt-24 prose-h2:mt-8 prose-h2:text-xl prose-h2:font-bold prose-h3:mt-6 prose-h3:text-lg prose-h3:font-bold prose-p:leading-7 prose-li:leading-7"
              dangerouslySetInnerHTML={{ __html: inhoudMetIds }}
            />

            {artikel.zoekwoorden && artikel.zoekwoorden.length > 0 && (
              <div className="mt-10 border-t border-slate-200 pt-5">
                <div className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-700">
                  <Tag className="h-4 w-4" />
                  Zoekwoorden
                </div>

                <div className="flex flex-wrap gap-2">
                  {artikel.zoekwoorden.map((woord) => (
                    <span
                      key={woord}
                      className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-500 ring-1 ring-slate-200"
                    >
                      {woord}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </article>

          <aside className="hidden lg:block">
            <div className="sticky top-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-sm font-bold text-slate-900">
                In dit artikel
              </h2>

              {toc.length > 0 ? (
                <nav className="space-y-2">
                  {toc.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className={`block rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-blue-50 hover:text-blue-700 ${
                        item.level === 3 ? "ml-4" : ""
                      }`}
                    >
                      {item.text}
                    </a>
                  ))}
                </nav>
              ) : (
                <p className="text-sm text-slate-500">
                  Geen tussenkoppen gevonden.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}