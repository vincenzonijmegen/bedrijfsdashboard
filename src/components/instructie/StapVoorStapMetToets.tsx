"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  html: string;
}

type Vraag = {
  vraag: string;
  opties: string[];
  antwoord: string;
};

export default function StapVoorStapMetToets({ html }: Props) {
  const [stappen, setStappen] = useState<string[]>([]);
  const [vragen, setVragen] = useState<Vraag[]>([]);
  const [index, setIndex] = useState(0);
  const [fase, setFase] = useState<"stappen" | "vragen" | "klaar">("stappen");
  const [feedback, setFeedback] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

useEffect(() => {
  const [stapDeel, ...vraagDeel] = html.split(/Vraag:\s/);

  const stepSegments = stapDeel
    .split("[end]")
    .map((s) => s.trim())
    .filter(Boolean);

  const questionPattern = /Vraag:\s*(.*?)<\/p>\s*A\.\s*(.*?)<\/p>\s*B\.\s*(.*?)<\/p>\s*C\.\s*(.*?)<\/p>\s*Antwoord:\s*([ABC])/gi;


  const vragenHTML = ("Vraag: " + vraagDeel.join("Vraag:")).replace(/\n/g, "<br>");
  const vraagMatches = Array.from(vragenHTML.matchAll(questionPattern)).map((m) => ({
    vraag: m[1].trim(),
    opties: [m[2].trim(), m[3].trim(), m[4].trim()],
    antwoord: m[5].trim().toUpperCase(),
  }));

  setStappen(stepSegments);
  setVragen(vraagMatches);
}, [html]);




  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        if (fase === "vragen" && feedback) setIndex((i) => Math.min(i + 1, vragen.length - 1));
        else if (fase !== "vragen") setIndex((i) => Math.min(i + 1, stappen.length - 1));
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [fase, index, feedback, stappen.length, vragen.length]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let startX = 0;

    const onTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
    };

    const onTouchEnd = (e: TouchEvent) => {
      const endX = e.changedTouches[0].clientX;
      const delta = endX - startX;

      if (delta < -40) setIndex((i) => Math.min(i + 1, fase === "vragen" ? vragen.length - 1 : stappen.length - 1));
      if (delta > 40) setIndex((i) => Math.max(i - 1, 0));
    };

    el.addEventListener("touchstart", onTouchStart);
    el.addEventListener("touchend", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [fase, index, stappen.length, vragen.length]);

  const selectAntwoord = (letter: "A" | "B" | "C") => {
    const juist = letter === vragen[index].antwoord;
    setFeedback(juist ? "✅ Goed!" : `❌ Fout. Juiste antwoord: ${vragen[index].antwoord}`);
  };

  const naarVolgende = () => {
    setFeedback(null);
    if (fase === "stappen" && index >= stappen.length - 1 && vragen.length > 0) {
      setFase("vragen");
      setIndex(0);
    } else if (fase === "vragen" && index >= vragen.length - 1) {
      setFase("klaar");
    } else {
      setIndex((i) => i + 1);
    }
  };

  return (
    <div ref={containerRef} className="max-w-4xl mx-auto p-4 space-y-4">
      {fase === "stappen" && (
        <>
          <div
            className="border rounded p-4 bg-white shadow min-h-[150px]"
            dangerouslySetInnerHTML={{ __html: stappen[index] }}
          />
          <div className="flex justify-between">
            <button
              onClick={() => setIndex((i) => Math.max(i - 1, 0))}
              disabled={index === 0}
              className="px-4 py-2 rounded bg-gray-300 disabled:opacity-40"
            >
              Vorige
            </button>
            <button
              onClick={naarVolgende}
              className="bg-blue-600 text-white px-4 py-2 rounded"
            >
              {index === stappen.length - 1 ? "Start toets (↵)" : "Volgende stap (↵)"}
            </button>
          </div>
        </>
      )}

      {fase === "vragen" && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Vraag {index + 1}</h2>
          <p>{vragen[index].vraag}</p>
          <div className="space-y-2">
            {["A", "B", "C"].map((letter, i) => (
              <button
                key={letter}
                onClick={() => selectAntwoord(letter as "A" | "B" | "C")}
                className="block w-full border rounded px-4 py-2 text-left bg-white hover:bg-blue-50"
                disabled={feedback !== null}
              >
                {letter}. {vragen[index].opties[i]}
              </button>
            ))}
          </div>
          {feedback && (
            <div className="text-sm mt-2">
              {feedback}
              <div className="mt-2">
                <button
                  onClick={naarVolgende}
                  className="bg-blue-600 text-white px-4 py-2 rounded"
                >
                  {index === vragen.length - 1 ? "Klaar" : "Volgende vraag (↵)"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {fase === "klaar" && (
        <div className="text-center text-green-700 text-xl font-semibold">
          ✅ Je hebt de volledige instructie afgerond!
        </div>
      )}
    </div>
  );
}
