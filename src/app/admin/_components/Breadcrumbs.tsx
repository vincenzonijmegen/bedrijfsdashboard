"use client";

import { usePathname } from "next/navigation";
import { ROUTES } from "../page";

export default function Breadcrumbs() {
  const pathname = usePathname();
  const match = ROUTES.find(r => pathname.startsWith(r.href));

  if (!match) return null;

  return (
    <div className="mb-3 text-sm text-muted-foreground">
      {match.breadcrumb}
    </div>
  );
}
