import "./globals.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import Providers from "@/app/providers"; // ⬅️ SWR provider
import { SnackbarProvider } from "@/lib/useSnackbar";

export const metadata = {
  title: "Vincenzo App",
  description: "Personeelsapp van IJssalon Vincenzo",
  manifest: "/manifest.json",
  themeColor: "#008080",
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/icon-512x512.png",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="nl">
      <head>
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#ffffff" />
      </head>
      <body>
        <Providers>
          <SnackbarProvider>
            {children}
          </SnackbarProvider>
        </Providers>
      </body>
    </html>
  );
}

