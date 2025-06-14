"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";





export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [fout, setFout] = useState("");
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
  e.preventDefault();
  const res = await fetch("/api/login", {
    method: "POST",
    body: JSON.stringify({ email, wachtwoord }),
  });
  const data = await res.json();

  if (data.success) {
    // 👇 Bewaar de gebruiker
    localStorage.setItem("gebruiker", JSON.stringify(data));

    if (data.moetWachtwoordWijzigen) {
      router.push(`/wachtwoord-wijzigen?email=${encodeURIComponent(email)}`);
    } else {
      router.push("/instructies");
    }
  } else {
    setFout(data.error || "Inloggen mislukt");
  }
}


  return (
    <form onSubmit={handleLogin} className="max-w-sm mx-auto mt-20 space-y-4">
      <h1 className="text-xl font-semibold">Inloggen</h1>

      <input
        type="email"
        placeholder="E-mailadres"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full p-2 border rounded"
        required
      />
      <input
        type="password"
        placeholder="Wachtwoord"
        value={wachtwoord}
        onChange={(e) => setWachtwoord(e.target.value)}
        className="w-full p-2 border rounded"
        required
      />
      {fout && <p className="text-red-600">{fout}</p>}

      <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">
        Inloggen
      </button>
    </form>
  );
}
