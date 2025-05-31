import { ClerkProvider, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import "./globals.css";

export const metadata = {
  title: "Werkinstructies",
  description: "Instructiesysteem voor personeel",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="nl">
        <body className="font-sans bg-gray-100 text-gray-900">
          <header className="bg-white shadow p-4 flex justify-between items-center">
            <div className="space-x-4">
              <Link href="/dashboard" className="text-blue-600 hover:underline">
                Instructies
              </Link>
              <Link href="/admin" className="text-blue-600 hover:underline">
                Beheer
              </Link>
            </div>
            <UserButton afterSignOutUrl="/" />
          </header>
          <main className="p-4">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
