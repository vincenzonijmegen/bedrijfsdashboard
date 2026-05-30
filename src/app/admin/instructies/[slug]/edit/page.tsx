'use client';
import Image from '@tiptap/extension-image';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Button } from '@/components/ui/button';
import { uploadAfbeelding } from "@/utils/r2ClientUpload";



export default function InstructieBewerken() {
  const router = useRouter();
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : Array.isArray(params?.slug) ? params?.slug[0] : '';

  const [titel, setTitel] = useState('');
  const [nummer, setNummer] = useState('');
  const [functies, setFuncties] = useState<string[]>([]);
  const [onboardingFase, setOnboardingFase] = useState<
    "voor_eerste_shift" | "binnen_2_weken" | "taakgericht"
  >("taakgericht");
  const [onboardingVerplicht, setOnboardingVerplicht] = useState(false);
  const [onboardingVolgorde, setOnboardingVolgorde] = useState("999");
  const [geladen, setGeladen] = useState(false);

  const functiekeuzes = [
    'scheppers overdag',
    'scheppers overdag + avond',
    'ijsvoorbereiders',
    'keukenmedewerkers',
  ];

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: 'Typ hier de instructie...',
      }),
    ],
    content: '', // Initieel leeg
  });

  useEffect(() => {
    if (!slug || !editor || geladen) return;
    fetch(`/api/instructies/${slug}`)
      .then((res) => res.json())
      .then((data) => {
        setTitel(data.titel);
        setNummer(data.nummer || '');
        setOnboardingFase(data.onboarding_fase || "taakgericht");
        setOnboardingVerplicht(Boolean(data.onboarding_verplicht));
        setOnboardingVolgorde(String(data.onboarding_volgorde ?? 999));
        setFuncties(() => {
          try {
            return Array.isArray(data.functies)
              ? data.functies
              : typeof data.functies === 'string'
              ? JSON.parse(data.functies)
              : [];
          } catch {
            return [];
          }
        });
        editor.commands.setContent(data.inhoud || '');
        setGeladen(true);
      });
  }, [slug, editor, geladen]);

  const handleOpslaan = async () => {
    if (!editor) return;
    const inhoud = editor.getHTML();
    const res = await fetch(`/api/instructies/${slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
      titel,
      inhoud,
      nummer,
      functies,
      onboarding_fase: onboardingFase,
      onboarding_verplicht: onboardingVerplicht,
      onboarding_volgorde: onboardingVolgorde,
    }),
    });
    if (res.ok) router.push('/admin/instructies');
    else alert('Opslaan mislukt');
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

      <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
        <h2 className="mb-3 font-semibold text-blue-950">Onboarding</h2>

        <div className="grid gap-3 md:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-blue-950">
              Fase
            </span>
            <select
              value={onboardingFase}
              onChange={(e) =>
                setOnboardingFase(
                  e.target.value as
                    | "voor_eerste_shift"
                    | "binnen_2_weken"
                    | "taakgericht"
                )
              }
              className="w-full rounded border border-blue-200 bg-white px-3 py-2"
            >
              <option value="voor_eerste_shift">Voor eerste shift</option>
              <option value="binnen_2_weken">Binnen eerste 2 weken</option>
              <option value="taakgericht">Taakgericht / naslag</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium text-blue-950">
              Volgorde
            </span>
            <input
              type="number"
              value={onboardingVolgorde}
              onChange={(e) => setOnboardingVolgorde(e.target.value)}
              className="w-full rounded border border-blue-200 bg-white px-3 py-2"
            />
          </label>

          <label className="flex items-end gap-2 rounded border border-blue-200 bg-white px-3 py-2">
            <input
              type="checkbox"
              checked={onboardingVerplicht}
              onChange={(e) => setOnboardingVerplicht(e.target.checked)}
            />
            <span className="text-sm font-medium text-blue-950">
              Verplicht onderdeel
            </span>
          </label>
        </div>
      </div>


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
              const input = document.createElement('input');
              input.type = 'file';
              input.accept = 'image/*';
              input.onchange = async () => {
                const file = input.files?.[0];
                if (file && editor) {
                  const url = await uploadAfbeelding(file);
editor.commands.insertContent(
  `<img src="${url}" style="width: 75%; display: block; margin: 0 auto;" />`
);

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
