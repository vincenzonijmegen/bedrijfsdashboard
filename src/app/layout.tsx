import { ClerkProvider, UserButton, auth } from "@clerk/nextjs";
import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "Werkinstructies",
  description: "Instructiesysteem voor personeel",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { userId, sessionClaims } = auth();
  const email = sessionClaims?.email as string | undefined;
  const isAdmin = email === "herman@ijssalonvincenzo.nl";

  return (
    <ClerkProvider>
      <html lang="nl">
        <body className="font-sans bg-gray-100 text-gray-900">
          <header className="bg-white shadow p-4 flex justify-between items-center">
            <div className="space-x-4">
              <Link href="/instructies" className="text-blue-600 hover:underline">
                Instructies
              </Link>
              {isAdmin && (
                <>
                  <Link href="/admin/instructies" className="text-blue-600 hover:underline">
                    Beheer
                  </Link>
                  <Link href="/admin/resultaten" className="text-blue-600 hover:underline">
                    Resultaten
                  </Link>
                </>
              )}
            </div>
            <UserButton afterSignOutUrl="/" />
          </header>
          <main className="p-4">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
