// app/layout.tsx (or layout.jsx/tsx in your app/ folder)
import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "IJssalon Vincenzo",
  description: "Managementportaal en werkinstructies",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  );
}
