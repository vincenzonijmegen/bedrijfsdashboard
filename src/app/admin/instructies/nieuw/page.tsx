"use client";

import { uploadAfbeelding } from "@/utils/r2ClientUpload";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { Button } from "@/components/ui/button";

export default function NieuweInstructie() {
  const [titel, setTitel] = useState("");
  const [editorKey] = useState(() => Math.random().toString(36).substring(2));
  const router = useRouter();

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image,
      Placeholder.configure({ placeholder: "Typ hier de instructie..." }),
    ],
    content: "",
  });

  const handleOpslaan = async () => {
    if (!titel.trim() || !editor) return;
    const inhoud = editor.getHTML();

    try {
      const res = await fetch("/api/instructies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titel, inhoud }),
      });

      console.log("📦 Status:", res.status);
      console.log("📦 Content-Type:", res.headers.get("content-type"));

      const rawText = await res.text();
      console.log("📦 Body als tekst:", rawText);

      let data;
      try {
        data = JSON.parse(rawText);
        console.log("✅ Parsed JSON:", data);
      } catch (err) {
        console.error("❌ JSON parse fout:", err);
        throw new Error("Backend gaf geen leesbare JSON terug");
      }

      if (!res.ok || !data?.slug) {
        throw new Error("Geen instructie teruggekregen");
      }

      router.push("/admin/instructies");
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
        {!editor ? (
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
                  if (file && editor) {
                    const url = await uploadAfbeelding(file);
                    editor.chain().focus().setImage({ src: url }).run();
                  }
                };
                input.click();
              }}
            >
              Afbeelding uploaden
            </Button>
            <EditorContent key={editorKey} editor={editor} />
          </>
        )}
      </div>

      <Button onClick={handleOpslaan}>Opslaan</Button>
    </main>
  );
}
