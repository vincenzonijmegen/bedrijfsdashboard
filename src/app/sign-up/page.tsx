// src/app/sign-up/page.tsx
"use client";

import dynamic from "next/dynamic";

const SignUp = dynamic(() =>
  import("@clerk/nextjs").then(mod => mod.SignUp),
  { ssr: false }
);

export default function SignUpPage() {
  return (
    <div className="flex justify-center items-center h-screen">
      <SignUp path="/sign-up" routing="path" signInUrl="/sign-in" />
    </div>
  );
}
