"use client";

import Link from "next/link";
import { ReactNode } from "react";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="p-4">
      <Link href="/admin" className="inline-block mb-6 text-sm text-blue-600 hover:underline">
        ← Terug naar admin-dashboard
      </Link>

      <div>{children}</div>
    </div>
  );
}
