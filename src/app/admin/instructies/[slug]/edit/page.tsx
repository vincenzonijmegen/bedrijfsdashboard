"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Button } from "@/components/ui/button";
import { uploadAfbeelding } from "@/lib/upload";
import { addImageExtension } from "@/lib/tiptap/addImageExtension";

export default function InstructieBewerken() {
  const router = useRouter();
  const params = useParams();
  const slug = params?.slug as string;

  const [titel, setTitel] = useState("");
  const [nummer, setNummer] = useState("");
  const [functies, setFuncties] = useState<string[]>([]);
  const [geladen, setGeladen] = useState(false);

  const functiekeuzes = [
    "scheppers overdag",
    "scheppers overdag + avond",
    "ijsvoorbereiders",
    "keukenmedewerkers",
  ];

  const editor = useEditor({
    extensions: [
      StarterKit,
      addImageExtension(uploadAfbeelding),
      Placeholder.configure({
        placeholder: "Typ hier de instructie...",
      }),
    ],
    content: "<p>...</p>",
  });

  useEffect(() => {
    if (!slug || !editor || geladen) return;
    fetch(`/api/instructies/${slug}`)
      .then((res) => res.json())
      .then((data) => {
        setTitel(data.titel);
        setNummer(data.nummer || "");
        setFuncties(data.functies || []);
        editor.commands.setContent(data.inhoud);
        setGeladen(true);
      });
  }, [slug, editor, geladen]);

  const handleOpslaan = async () => {
    if (!editor) return;
    const inhoud = editor.getHTML();
    const res = await fetch(`/api/instructies/${slug}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titel, inhoud, nummer, functies }),
    });
    if (res.ok) router.push("/admin/instructies");
    else alert("Opslaan mislukt");
  };

  return (
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Instructie bewerken</h1>

      <input
        type="text"
        placeholder="Titel"
        value={titel}
        onChange={(e) => setTitel(e.target.value)}
        className="w-full mb-4 border rounded px-3 py-2"
      />

      <input
        type="text"
        placeholder="Instructienummer (bijv. 1.1)"
        value={nummer}
        onChange={(e) => setNummer(e.target.value)}
        className="w-full mb-4 border rounded px-3 py-2"
      />

      <div className="mb-4">
        <label className="font-medium">Toon voor functies:</label>
        <div className="grid grid-cols-2 gap-2 mt-1">
          {functiekeuzes.map((f) => (
            <label key={f} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={functies.includes(f)}
                onChange={(e) =>
                  setFuncties((prev) =>
                    e.target.checked ? [...prev, f] : prev.filter((v) => v !== f)
                  )
                }
              />
              {f}
            </label>
          ))}
        </div>
      </div>

      {editor && (
        <div className="mb-2">
          <Button
  type="button"
  size="sm"
  onClick={async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (file && editor) {
        const url = await uploadAfbeelding(file);
        editor.chain().focus().setImage({ src: url }).run();
      }
    };
    input.click();
  }}
>
  📷 Afbeelding toevoegen
</Button>
        </div>
      )}

      <div className="prose max-w-none mb-4 min-h-[200px] border rounded p-4">
        {editor ? <EditorContent editor={editor} /> : <p>Editor wordt geladen...</p>}
      </div>

      <Button onClick={handleOpslaan}>Opslaan</Button>
    </main>
  );
}
