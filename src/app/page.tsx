import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function Home() {
  const { sessionClaims } = await auth();
  const email = sessionClaims?.email as string | undefined;

  if (!email) {
    redirect("/sign-in");
  } else if (email === "herman@ijssalonvincenzo.nl") {
    redirect("/admin");
  } else {
    redirect("/instructies");
  }
}
