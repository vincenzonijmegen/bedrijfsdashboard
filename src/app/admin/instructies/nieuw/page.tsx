"use client";

import { uploadAfbeelding } from "@/utils/r2ClientUpload";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor, Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Button } from "@/components/ui/button";

export default function NieuweInstructie() {
  const [titel, setTitel] = useState("");
  const [editorInstance, setEditorInstance] = useState<Editor | null>(null);
  const router = useRouter();

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Placeholder.configure({ placeholder: "Typ hier de instructie..." }),
    ],
    content: "",
    onCreate: ({ editor }) => setEditorInstance(editor),
  });

  const handleOpslaan = async () => {
    if (!titel.trim() || !editorInstance) return;
    const inhoud = editorInstance.getHTML();

    try {
      const res = await fetch("/api/instructies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titel, inhoud }),
      });

      const data = await res.json();

      if (!res.ok || !data.instructie) {
        throw new Error("Geen instructie teruggekregen");
      }

      router.push("/dashboard");
    } catch (err) {
      console.error("🛑 Fout bij toevoegen:", err);
      alert("Fout bij opslaan. Probeer het later opnieuw.");
    }
  };

  return (
    <main className="max-w-2xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Nieuwe instructie</h1>

      <input
        type="text"
        placeholder="Titel"
        value={titel}
        onChange={(e) => setTitel(e.target.value)}
        className="w-full mb-4 border rounded px-3 py-2"
      />

      <div className="prose max-w-none mb-4 min-h-[200px] border rounded p-2">
        {!editorInstance ? (
          <p className="text-sm text-gray-500">Editor wordt geladen...</p>
        ) : (
          <>
            <Button
              className="mb-2"
              onClick={async () => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = "image/*";
                input.onchange = async () => {
                  const file = input.files?.[0];
                  if (file && editorInstance) {
                    const url = await uploadAfbeelding(file);
                    editorInstance.chain().focus().setImage({ src: url }).run();
                  }
                };
                input.click();
              }}
            >
              Afbeelding uploaden
            </Button>
            <EditorContent editor={editorInstance} />
          </>
        )}
      </div>

      <Button onClick={handleOpslaan}>Opslaan</Button>
    </main>
  );
}
