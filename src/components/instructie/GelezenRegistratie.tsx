"use client";
import { useEffect } from "react";
import { useSWRConfig } from "swr";

export default function GelezenRegistratie({ instructie_id }: { instructie_id: string }) {
  const { mutate } = useSWRConfig();

  useEffect(() => {
    const gebruiker = JSON.parse(localStorage.getItem("gebruiker") || "{}");
    if (!gebruiker?.email || !instructie_id) return;

    fetch("/api/instructiestatus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: gebruiker.email, instructie_id }),
    }).then((res) => {
      if (res.ok) {
        mutate(`/api/instructiestatus?email=${gebruiker.email}`);
      }
    });
  }, [instructie_id, mutate]);

  return null;
}
