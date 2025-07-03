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
    <head>
      <link rel="icon" href="/favicon.ico" />
      <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      <meta name="theme-color" content="#ffffff" />
    </head>
    <body>{children}</body>
  </html>
);
}