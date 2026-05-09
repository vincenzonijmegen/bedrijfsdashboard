"use client";

import Link from "next/link";
import { uploadAfbeelding } from "@/utils/r2ClientUpload";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { ArrowLeft, ImagePlus, Save, Video } from "lucide-react";

export default function NieuwInfotheekArtikelPage() {
  const router = useRouter();

  const [titel, setTitel] = useState("");
  const [categorie, setCategorie] = useState("");
  const [samenvatting, setSamenvatting] = useState("");
  const [zoekwoordenInput, setZoekwoordenInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editorKey] = useState(() => Math.random().toString(36).substring(2));

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Placeholder.configure({
        placeholder:
          "Schrijf hier de handleiding. Gebruik koppen voor duidelijke hoofdstukken.",
      }),
    ],
    content: "",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!editor) {
      setError("Editor is nog niet geladen.");
      return;
    }

    const inhoud = editor.getHTML();

    setSaving(true);

    try {
      const zoekwoorden = zoekwoordenInput
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);

      const res = await fetch("/api/infotheek", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          titel,
          categorie,
          samenvatting,
          inhoud,
          zoekwoorden,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Opslaan mislukt");
      }

      router.push(`/admin/infotheek/${data.slug}`);
    } catch (err: any) {
      setError(err.message || "Opslaan mislukt");
    } finally {
      setSaving(false);
    }
  }

  async function afbeeldingUploaden() {
    if (!editor) return;

    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";

    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;

      try {
        const url = await uploadAfbeelding(file);
        editor.commands.insertContent(
          `<img src="${url}" style="width: 75%; display: block; margin: 1rem auto;" />`
        );
      } catch {
        setError("Afbeelding uploaden mislukt.");
      }
    };

    input.click();
  }

  function youtubeToevoegen() {
    if (!editor) return;

    const link = prompt(
      "Plak hier de YouTube-link, bijvoorbeeld https://youtu.be/abc123"
    );

    if (!link) return;

    let rawId = "";

    if (link.includes("watch?v=")) {
      rawId = link.split("watch?v=")[1].split("&")[0];
    } else {
      rawId = link.split("/").pop()?.split("?")[0] || "";
    }

    if (!rawId) return;

    const iframe = `<iframe src="https://www.youtube.com/embed/${rawId}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen class="w-full aspect-video rounded-xl my-4"></iframe>`;

    editor.commands.insertContent(iframe);
  }

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link
          href="/admin/infotheek"
          className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700 hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          Terug naar Infotheek
        </Link>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div className="mb-6 border-b border-slate-200 pb-5">
            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              Nieuw artikel
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Maak een nieuwe handleiding voor de Infotheek.
            </p>
          </div>

          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-5">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Titel
              </label>
              <input
                value={titel}
                onChange={(e) => setTitel(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="Bijvoorbeeld: Nieuwe medewerker aannemen"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Categorie
              </label>
              <input
                value={categorie}
                onChange={(e) => setCategorie(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="Bijvoorbeeld: Medewerkers"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Samenvatting
              </label>
              <textarea
                value={samenvatting}
                onChange={(e) => setSamenvatting(e.target.value)}
                className="min-h-24 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="Korte uitleg die op de overzichtspagina zichtbaar is."
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">
                Inhoud
              </label>

              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex flex-wrap gap-2 border-b border-slate-200 bg-slate-50 p-3">
                  <button
                    type="button"
                    onClick={() =>
                      editor?.chain().focus().toggleHeading({ level: 2 }).run()
                    }
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Kop
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      editor?.chain().focus().toggleHeading({ level: 3 }).run()
                    }
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Subkop
                  </button>

                  <button
                    type="button"
                    onClick={() => editor?.chain().focus().toggleBold().run()}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Vet
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      editor?.chain().focus().toggleBulletList().run()
                    }
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    Lijst
                  </button>

                  <button
                    type="button"
                    onClick={afbeeldingUploaden}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <ImagePlus className="h-4 w-4" />
                    Afbeelding
                  </button>

                  <button
                    type="button"
                    onClick={youtubeToevoegen}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <Video className="h-4 w-4" />
                    YouTube
                  </button>
                </div>

                <div className="prose prose-slate min-h-[360px] max-w-none p-4 prose-headings:font-bold prose-p:leading-7 prose-li:leading-7">
                  {!editor ? (
                    <p className="text-sm text-slate-500">
                      Editor wordt geladen...
                    </p>
                  ) : (
                    <EditorContent key={editorKey} editor={editor} />
                  )}
                </div>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Gebruik koppen en subkoppen. Die verschijnen automatisch in de
                inhoudsopgave van het artikel.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-700">
                Zoekwoorden
              </label>
              <input
                value={zoekwoordenInput}
                onChange={(e) => setZoekwoordenInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                placeholder="Bijvoorbeeld: medewerker, sollicitatie, onboarding"
              />
              <p className="mt-2 text-xs text-slate-500">
                Scheid zoekwoorden met komma’s.
              </p>
            </div>
          </div>

          <div className="mt-8 flex justify-end gap-3 border-t border-slate-200 pt-5">
            <Link
              href="/admin/infotheek"
              className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Annuleren
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {saving ? "Opslaan..." : "Artikel opslaan"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}