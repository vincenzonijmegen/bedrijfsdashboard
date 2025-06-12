import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const { sessionClaims } = await auth();
  const email = sessionClaims?.email as string | undefined;

  if (!email) {
    redirect("/sign-in");
  }
  if (email === "herman@ijssalonvincenzo.nl") {
    redirect("/admin");
  }
  redirect("/instructies");
}
