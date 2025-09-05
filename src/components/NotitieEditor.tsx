// src/components/NotitieEditor.tsx
'use client';

import React, { useEffect, useMemo } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import PlaceholderExt from '@tiptap/extension-placeholder';

// ---- helpers: plak-normalisatie ----
function sanitizeHtmlBasic(html: string) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const allowed = new Set([
    'P', 'BR', 'STRONG', 'EM', 'U', 'A',
    'UL', 'OL', 'LI', 'H1', 'H2', 'H3',
    'BLOCKQUOTE', 'CODE', 'PRE',
  ]);

  const walk = (node: Node) => {
    if (node instanceof HTMLElement) {
      node.removeAttribute('style');
      node.removeAttribute('class');
      node.removeAttribute('size');
      node.removeAttribute('face');
      [...node.attributes].forEach(attr => {
        if (/^(data-|aria-|mso-|o:|v:)/i.test(attr.name)) node.removeAttribute(attr.name);
      });

      if (!allowed.has(node.tagName)) {
        const parent = node.parentNode;
        while (node.firstChild) parent?.insertBefore(node.firstChild, node);
        parent?.removeChild(node);
        return;
      }
      if (node.tagName === 'A') {
        const href = node.getAttribute('href') || '';
        if (!/^https?:\/\//i.test(href)) node.removeAttribute('href');
        node.setAttribute('rel', 'noopener noreferrer');
        node.setAttribute('target', '_blank');
      }
    }
    Array.from(node.childNodes).forEach(walk);
  };

  walk(doc.body);
  return doc.body.innerHTML;
}

function escapeText(text: string) {
  const div = document.createElement('div');
  div.innerText = text;
  return div.innerHTML.replace(/\n/g, '<br>');
}

// ---- component ----
export interface NotitieEditorProps {
  value: string;
  onChange: (html: string) => void;
  editable?: boolean;
  placeholder?: string;
}

export default function NotitieEditor({
  value,
  onChange,
  editable = true,
  placeholder = 'Schrijf je notitie…',
}: NotitieEditorProps) {
  const editor = useEditor(
    {
      extensions: [
        StarterKit,
        Underline,
        Link.configure({ openOnClick: false, autolink: true, protocols: ['http', 'https'] }),
        TextAlign.configure({ types: ['heading', 'paragraph'] }),
        PlaceholderExt.configure({ placeholder }), // <-- gebruikt de prop
      ],
      content: value || '<p></p>',
      editable,
      onUpdate: ({ editor }) => {
        onChange(editor.getHTML());
      },
    },
    [value, editable, placeholder]
  );

  // Sync externe waarde (bij annuleren of server refresh)
  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value || '<p></p>', false);
    }
  }, [value, editor]);

  // Toggle editmodus
  useEffect(() => {
    editor?.setEditable(!!editable);
  }, [editable, editor]);

  // Plak-normalisatie
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const handler = (e: ClipboardEvent) => {
      const html = e.clipboardData?.getData('text/html');
      const text = e.clipboardData?.getData('text/plain') || '';
      if (!html && !text) return;
      e.preventDefault();
      const safe = html ? sanitizeHtmlBasic(html) : escapeText(text);
      editor.commands.insertContent(safe);
    };
    dom.addEventListener('paste', handler);
    return () => dom.removeEventListener('paste', handler);
  }, [editor]);

  // Toolbar
  const toolbar = useMemo(
    () => (
      <div className="flex flex-wrap gap-1 p-1 border-b bg-gray-50">
        <button className="px-2 py-1 border rounded" onMouseDown={e=>e.preventDefault()} onClick={() => editor?.chain().focus().toggleBold().run()}>B</button>
        <button className="px-2 py-1 border rounded italic" onMouseDown={e=>e.preventDefault()} onClick={() => editor?.chain().focus().toggleItalic().run()}>I</button>
        <button className="px-2 py-1 border rounded underline" onMouseDown={e=>e.preventDefault()} onClick={() => editor?.chain().focus().toggleUnderline().run()}>U</button>
        <span className="mx-1" />
        <button className="px-2 py-1 border rounded" onMouseDown={e=>e.preventDefault()} onClick={() => editor?.chain().focus().toggleBulletList().run()}>• List</button>
        <button className="px-2 py-1 border rounded" onMouseDown={e=>e.preventDefault()} onClick={() => editor?.chain().focus().toggleOrderedList().run()}>1. List</button>
        <span className="mx-1" />
        <button className="px-2 py-1 border rounded" onMouseDown={e=>e.preventDefault()} onClick={() => editor?.chain().focus().setParagraph().run()}>¶</button>
        <button className="px-2 py-1 border rounded" onMouseDown={e=>e.preventDefault()} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}>H2</button>
        <button className="px-2 py-1 border rounded" onMouseDown={e=>e.preventDefault()} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}>H3</button>
        <span className="mx-1" />
        <button className="px-2 py-1 border rounded" onMouseDown={e=>e.preventDefault()} onClick={() => editor?.chain().focus().setTextAlign('left').run()}>⟸</button>
        <button className="px-2 py-1 border rounded" onMouseDown={e=>e.preventDefault()} onClick={() => editor?.chain().focus().setTextAlign('center').run()}>≡</button>
        <button className="px-2 py-1 border rounded" onMouseDown={e=>e.preventDefault()} onClick={() => editor?.chain().focus().setTextAlign('right').run()}>⟹</button>
        <span className="mx-1" />
        <button
          className="px-2 py-1 border rounded"
          title="Opmaak wissen"
          onMouseDown={e=>e.preventDefault()}
          onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()}
        >
          ⌫ Opmaak
        </button>
      </div>
    ),
    [editor]
  );

  return (
    <div className="border rounded">
      {editable && toolbar}
      <div className="p-3 prose max-w-none text-base">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
