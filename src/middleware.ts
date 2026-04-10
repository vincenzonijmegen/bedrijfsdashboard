import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export default clerkMiddleware(async (_auth, _req: NextRequest) => {
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api|sign-in|sign-up|sign-in/.*|sign-up/.*|_next/static|_next/image|favicon.ico).*)",
  ],
};