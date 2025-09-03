"use client";

import { usePathname } from "next/navigation";
import { matchRoute } from "./routeRegistry";

export default function Breadcrumbs() {
  const pathname = usePathname();
  const match = matchRoute(pathname);

  if (!match) return null;

  return (
    <div className="mb-3 text-sm text-muted-foreground">
      {match.breadcrumb}
    </div>
  );
}
