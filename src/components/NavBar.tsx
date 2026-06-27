"use client";

import Link from "next/link";

export function NavBar() {
  return (
    <header className="bg-white shadow p-4 flex justify-between items-center">
      <div className="space-x-4">
        <Link href="/" className="text-blue-600 hover:underline">
          Start
        </Link>

        <Link href="/sign-in" className="text-blue-600 hover:underline">
          Beheer login
        </Link>
      </div>
    </header>
  );
}