"use client";
import { SignInButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  return (
    <main className="p-8">
      <SignedOut>
        <h1 className="text-2xl mb-4">Log in om werkinstructies te bekijken</h1>
        <SignInButton />
      </SignedOut>
      <SignedIn>
        <div className="flex justify-between items-center">
          <h1 className="text-2xl">Welkom!</h1>
          <UserButton />
        </div>
        <button
          onClick={() => router.push("/dashboard")}
          className="mt-6 px-4 py-2 bg-blue-600 text-white rounded"
        >
          Ga naar dashboard
        </button>
      </SignedIn>
    </main>
  );
}
