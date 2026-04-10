import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Vincenzo Keuken",
  description: "Keukenapp van IJssalon Vincenzo",
  manifest: "/manifest-keuken.json",
  appleWebApp: {
    capable: true,
    title: "Keuken",
    statusBarStyle: "default",
  },
  icons: {
    icon: "/icons/icon-192x192.png",
    apple: "/icons/icon-512x512.png",
  },
};

export default function KeukenLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}