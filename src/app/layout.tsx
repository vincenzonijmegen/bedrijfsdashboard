import "../styles/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "IJssalon Vincenzo",
  description: "Managementportaal en werkinstructies",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className="bg-white text-gray-900 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
