import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SnackbarProvider } from '@/lib/useSnackbar'; // ✅ toevoegen

export const metadata: Metadata = {
  title: "Bedrijfsdashboard Vincenzo",
  description: "Bedrijfsdashboard IJssalon Vincenzo",
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
      <body>
        <SnackbarProvider> {/* ✅ wrap je app in SnackbarProvider */}
          {children}
        </SnackbarProvider>
      </body>
    </html>
  );
}
