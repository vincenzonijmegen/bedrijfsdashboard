"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Button } from "@/components/ui/button";
import { uploadAfbeelding } from "@/utils/r2ClientUpload";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    export default function InstructieBewerkPagina({ params }: any) {
  const [titel, setTitel] = useState("");
  const router = useRouter();

  const editor = useEditor({
    extensions: [StarterKit, Image, Placeholder.configure({ placeholder: "Typ hier de instructie..." })],
    content: "",
  });

  useEffect(() => {
    fetch(`/api/instructies/${params.slug}`)
      .then((res) => res.json())
      .then((data) => {
        setTitel(data.titel);
        editor?.commands.setContent(data.inhoud);
      });
  }, [params.slug, editor]);

  const handleOpslaan = async () => {
    if (!editor) return;
    const inhoud = editor.getHTML();

    const res = await fetch(`/api/instructies/${params.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titel, inhoud }),
    });

    if (res.ok) router.push("/admin/instructies");
    else alert("Fout bij opslaan");
  };

  const handleVerwijderen = async () => {
    if (!confirm("Weet je zeker dat je deze instructie wilt verwijderen?")) return;
    const res = await fetch(`/api/instructies/${params.slug}`, { method: "DELETE" });
    if (res.ok) router.push("/admin/instructies");
    else alert("Verwijderen mislukt");
  };

  return (
    <main className="max-w-2xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Instructie bewerken</h1>

      <input
        type="text"
        value={titel}
        onChange={(e) => setTitel(e.target.value)}
        className="w-full border rounded px-3 py-2"
      />

      {editor && (
        <>
          <Button
            className="mb-2"
            onClick={async () => {
              const input = document.createElement("input");
              input.type = "file";
              input.accept = "image/*";
              input.onchange = async () => {
                const file = input.files?.[0];
                if (file) {
                  const url = await uploadAfbeelding(file);
                  editor.chain().focus().setImage({ src: url }).run();
                }
              };
              input.click();
            }}
          >
            Afbeelding uploaden
          </Button>

          <div className="prose max-w-none border rounded p-2">
            <EditorContent editor={editor} />
          </div>
        </>
      )}

      <div className="flex gap-2">
        <Button onClick={handleOpslaan}>Opslaan</Button>
        <Button variant="destructive" onClick={handleVerwijderen}>
          Verwijderen
        </Button>
      </div>
    </main>
  );
}
