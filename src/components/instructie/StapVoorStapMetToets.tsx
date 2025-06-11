"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
localStorage.setItem("email", "voorbeeld@vincenzo.nl");

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
  const [score, setScore] = useState(0);
  const [aantalJuist, setAantalJuist] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const pathname = usePathname();
  const slug = pathname ? pathname.split("/").pop() : null;

  useEffect(() => {
    const [stapDeel, ...vraagDeel] = html.split(/Vraag:\s/);

    const stepSegments = stapDeel
      .split("[end]")
      .map((s) => s.trim())
      .filter(Boolean);

    const questionPattern = /Vraag:\s*(.*?)\s*A\.\s*(.*?)\s*B\.\s*(.*?)\s*C\.\s*(.*?)\s*Antwoord:\s*([ABC])/gi;

    const vragenHTML = ("Vraag: " + vraagDeel.join("Vraag:")).replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
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
    if (juist) setAantalJuist((n) => n + 1);
    setFeedback(juist ? "✅ Goed!" : `❌ Fout. Juiste antwoord: ${vragen[index].antwoord}`);
  };

  const naarVolgende = () => {
    setFeedback(null);
    if (fase === "stappen" && index >= stappen.length - 1 && vragen.length > 0) {
      setFase("vragen");
      setIndex(0);
    } else if (fase === "vragen" && index >= vragen.length - 1) {
      const percentage = vragen.length > 0 ? Math.round((aantalJuist / vragen.length) * 100) : 0;
      setScore(percentage);
      setFase("klaar");

      const emailFromStorage = localStorage.getItem("email");

      console.log("📤 Logging resultaat naar API", {
        email: emailFromStorage ?? "onbekend@vincenzo.nl",
        score: percentage,
        aantalJuist,
        totaal: vragen.length,
        tijdstip: new Date().toISOString(),
        slug,
      });

      fetch("/api/logscore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: emailFromStorage,
          score: percentage,
          aantalJuist,
          totaal: vragen.length,
          tijdstip: new Date().toISOString(),
          slug,
        }),
      })
        .then((res) => res.json())
        .then((res) => console.log("✅ API-response:", res))
        .catch((err) => console.error("❌ API-fout:", err));
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
                  {index === vragen.length - 1 ? "Bekijk resultaat" : "Volgende vraag (↵)"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {fase === "klaar" && (
        <div className="text-center text-xl font-semibold">
          <p className={score >= 80 ? "text-green-700" : "text-red-700"}>
            {score >= 80 ? "✅ Geslaagd!" : "❌ Niet geslaagd."} Je score: {score}%<br />
            {aantalJuist} van {vragen.length} goed beantwoord
          </p>
        </div>
      )}
    </div>
  );
}
