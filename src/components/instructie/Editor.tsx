"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";

export default function Editor({
  name,
  defaultContent,
}: {
  name: string;
  defaultContent: string;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: defaultContent,
  });

  // Update form value on change
useEffect(() => {
  if (!editor) return;

  const update = () => {
    const hidden = document.querySelector(`input[name='${name}']`) as HTMLInputElement;
    if (hidden) hidden.value = editor.getHTML();
  };

  editor.on("update", update);
  update();

  return () => {
    editor.off("update", update);
  };
}, [editor, name]); // voeg 'name' toe om ESLint happy te maken

