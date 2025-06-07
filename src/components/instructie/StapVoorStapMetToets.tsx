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
    const stepPattern = /(?:^|\n)(\d{1,2}\..*?)(?=(\n\d+\.)|$)/g;
    const questionPattern =
      /Vraag:\s*(.*?)\nA\.\s*(.*?)\nB\.\s*(.*?)\nC\.\s*(.*?)\nAntwoord:\s*([ABC])/g;

    const stepMatches = Array.from(html.matchAll(stepPattern)).map((m) => m[1].trim());
    const vraagMatches = Array.from(html.matchAll(questionPattern)).map((m) => ({
      vraag: m[1].trim(),
      opties: [m[2].trim(), m[3].trim(), m[4].trim()],
      antwoord: m[5].trim().toUpperCase(),
    }));

    setStappen(stepMatches);
    setVragen(vraagMatches);
  }, [html]);

  const volgendeStap = () => {
    if (fase === "stappen") {
      if (index < stappen.length - 1) {
        setIndex((i) => i + 1);
      } else if (vragen.length > 0) {
        setFase("vragen");
        setIndex(0);
      } else {
        setFase("klaar");
      }
    } else if (fase === "vragen") {
      setFeedback(null);
      if (index < vragen.length - 1) {
        setIndex((i) => i + 1);
      } else {
        setFase("klaar");
      }
    }
  };

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === "Enter") {
      if (fase === "vragen" && feedback) volgendeStap();
      else if (fase !== "vragen") volgendeStap();
    }
  };

  useEffect(() => {
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [fase, index, feedback]);

  const selectAntwoord = (letter: "A" | "B" | "C") => {
    const juist = letter === vragen[index].antwoord;
    setFeedback(juist ? "✅ Goed!" : `❌ Fout. Juiste antwoord: ${vragen[index].antwoord}`);
  };

  return (
    <div ref={containerRef} className="max-w-xl mx-auto p-4 space-y-4">
      {fase === "stappen" && (
        <>
          <div
            className="border rounded p-4 bg-white shadow min-h-[150px]"
            dangerouslySetInnerHTML={{ __html: stappen[index] }}
          />
          <div className="flex justify-end">
            <button
              onClick={volgendeStap}
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
                  onClick={volgendeStap}
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
