"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Props {
  html: string;
  instructie_id: string;
  titel: string;
}

type Vraag = {
  vraag: string;
  opties: string[];
  antwoord: string;
};

export default function StapVoorStapMetToets({ html, instructie_id, titel }: Props) {
  const [stappen, setStappen] = useState<string[]>([]);
  const [vragen, setVragen] = useState<Vraag[]>([]);
  const [index, setIndex] = useState(0);
  const [fase, setFase] = useState<"stappen" | "vragen" | "klaar">("stappen");
  const [heeftToets, setHeeftToets] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [aantalJuist, setAantalJuist] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const startTijd = useRef<number | null>(null);
  const [fouten, setFouten] = useState<
    { vraag: string; gegeven: string; gekozenTekst: string }[]
  >([]);

  useEffect(() => {
    startTijd.current = Date.now();
    return () => {
      const eindTijd = Date.now();
      const duurSec = Math.round((eindTijd - (startTijd.current || eindTijd)) / 1000);
      const gebruiker = JSON.parse(localStorage.getItem("gebruiker") || "{}");
      fetch("/api/instructielog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: gebruiker.email,
          naam: gebruiker.naam,
          functie: gebruiker.functie,
          titel,
          instructie_id,
          duur_seconden: duurSec,
        }),
      });
    };
  }, [instructie_id]);

  useEffect(() => {
    const gebruiker = JSON.parse(localStorage.getItem("gebruiker") || "{}");
    if (!gebruiker?.email || !instructie_id) return;

    fetch("/api/instructiestatus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: gebruiker.email, instructie_id })
    });

    const parts = html.split("[end]");
    const stepSegments = parts.slice(0, -1).map((s) => s.trim()).filter(Boolean);
    const vraagDeel = parts.slice(-1)[0] || "";
    const vragenHTML = vraagDeel.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");

    const questionPattern = /Vraag[:.]\s*(.*?)\s*A\.\s*(.*?)\s*B\.\s*(.*?)\s*C\.\s*(.*?)\s*Antwoord:\s*([ABC])/gi;
    const vraagMatches = Array.from(vragenHTML.matchAll(questionPattern)).map((m) => ({
      vraag: m[1].trim(),
      opties: [m[2].trim(), m[3].trim(), m[4].trim()],
      antwoord: m[5].trim().toUpperCase(),
    }));

    setStappen(stepSegments);
    setVragen(vraagMatches);
    setHeeftToets(vraagMatches.length > 0);
  }, [instructie_id, html]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        if (fase === "vragen" && feedback && heeftToets) setIndex((i) => Math.min(i + 1, vragen.length - 1));
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
    const onTouchStart = (e: TouchEvent) => { startX = e.touches[0].clientX; };
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
    if (juist) {
      setAantalJuist((n) => n + 1);
    } else {
      setFouten((f) => [
        ...f,
        {
          vraag: vragen[index].vraag,
          gegeven: letter,
          gekozenTekst: vragen[index].opties[["A", "B", "C"].indexOf(letter)],
        },
      ]);
    }
    setFeedback(juist ? "✅ Goed!" : `❌ Fout. Juiste antwoord: ${vragen[index].antwoord}`);
  };

  const naarVolgende = () => {
    setFeedback(null);
    const gebruiker = JSON.parse(localStorage.getItem("gebruiker") || "{}");
    if (fase === "stappen" && index >= stappen.length - 1 && heeftToets) {
      setFase("vragen");
      setIndex(0);
    } else if (fase === "vragen" && index >= vragen.length - 1 && heeftToets) {
      const percentage = Math.round((aantalJuist / vragen.length) * 100);
      setScore(percentage);
      setFase("klaar");
      fetch("/api/resultaten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: gebruiker.email,
          naam: gebruiker.naam,
          functie: gebruiker.functie,
          titel,
          instructie_id,
          score: percentage,
          juist: aantalJuist,
          totaal: vragen.length,
          fouten,
        }),
      }).catch((err) => console.error("❌ API-fout:", err));
    } else if (!heeftToets && index >= stappen.length - 1) setFase("klaar");
    else setIndex((i) => i + 1);
  };

  return (
    <div ref={containerRef} className="max-w-4xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">{titel}</h1>
      {fase === "stappen" && (
        <>
          <div
            className="border rounded p-4 bg-white shadow min-h-[150px] prose prose-blue max-w-none"
            dangerouslySetInnerHTML={{
              __html: (stappen[index] || '').replace(
                /<a[^>]*href=["'](https?:\/\/(?:www\.)?(?:youtube\.com\/watch\?v=|youtu\.be\/)[^"']+)["'][^>]*>[\s\S]*?<\/a>/gi,
                (match, url) => {
                  const rawId = url.includes('watch?v=')
                    ? url.split('watch?v=')[1].split('&')[0]
                    : url.split('/').pop()?.split('?')[0] || '';
                  return `<div class="aspect-video max-w-full rounded overflow-hidden mb-4">
                    <iframe
                      class="w-full h-full"
                      src="https://www.youtube.com/embed/${rawId}"
                      frameborder="0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowfullscreen
                    ></iframe>
                  </div>`;
                }
              )
            }}
          />

          <div className="flex justify-between">
            <button onClick={() => setIndex((i) => Math.max(i - 1, 0))} disabled={index === 0} className="px-4 py-2 rounded bg-gray-300 disabled:opacity-40">
              Vorige
            </button>
            <button onClick={naarVolgende} className="bg-blue-600 text-white px-4 py-2 rounded">
              {index === stappen.length - 1 && heeftToets ? "Start toets (↵)" : "Volgende stap (↵)"}
            </button>
          </div>
        </>
      )}

      {/* vragen- en klaar-fase blijven ongewijzigd */}
    </div>
  );
}
