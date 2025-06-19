"use client";

import { useEffect } from "react";

export default function GelezenRegistratie({ instructie_id }: { instructie_id: string }) {
  useEffect(() => {
    const gebruiker = JSON.parse(localStorage.getItem("gebruiker") || "{}");
    if (!gebruiker?.email || !instructie_id) return;

    fetch("/api/instructiestatus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: gebruiker.email, instructie_id }),
    }).catch((err) => {
      console.warn("❌ Mislukt om gelezen status op te slaan", err);
    });
  }, [instructie_id]);

  return null;
}
