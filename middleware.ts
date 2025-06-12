import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    /*
     * Bescherm alle routes behalve:
     * - statische bestanden
     * - Next.js API routes (indien nodig pas dit aan)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
