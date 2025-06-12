import { ClerkProvider } from "@clerk/nextjs";
import { NavBar } from "../components/NavBar";
import "./globals.css";

export const metadata = {
  title: "Werkinstructies",
  description: "Instructiesysteem voor personeel",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}>
      <html lang="nl">
        <body className="font-sans bg-gray-100 text-gray-900">
          <NavBar />
          <main className="p-4">{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}