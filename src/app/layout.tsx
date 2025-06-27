import { ClerkProvider } from "@clerk/nextjs";
import { NavBar } from "../components/NavBar";
import "./globals.css";
import "@/styles/globals.css";


export const metadata = {
  title: "Werkinstructies",
  description: "Instructiesysteem voor personeel",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      <html lang="nl">
        <body className="font-sans bg-gray-100 text-gray-900">
          <img
            src="/logo-vincenzo.png"
            alt="Vincenzo logo"
            className="fixed top-4 right-4 w-24 h-auto z-50"
          />
          <NavBar />
          <main className="p-4">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
