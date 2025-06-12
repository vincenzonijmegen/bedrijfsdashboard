"use client";

import { useUser, UserButton } from "@clerk/nextjs";
import Link from "next/link";

export function NavBar() {
  const { user } = useUser();
  const email = user?.primaryEmailAddress?.emailAddress;
  const isAdmin = email === "herman@ijssalonvincenzo.nl";

  return (
    <header className="bg-white shadow p-4 flex justify-between items-center">
      <div className="space-x-4">
        <Link href="/instructies" className="text-blue-600 hover:underline">Instructies</Link>
        {isAdmin && (
          <>
            <Link href="/admin/instructies" className="text-blue-600 hover:underline">Beheer</Link>
            <Link href="/admin/resultaten" className="text-blue-600 hover:underline">Resultaten</Link>
          </>
        )}
      </div>
      <UserButton afterSignOutUrl="/" />
    </header>
  );
}
