import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    "/((?!api|sign-in|sign-up|sign-in/.*|sign-up/.*|_next/static|_next/image|favicon.ico).*)",
  ],
};
