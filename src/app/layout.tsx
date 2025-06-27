// src/app/layout.tsx
import "@/styles/globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "IJssalon Vincenzo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className="bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
