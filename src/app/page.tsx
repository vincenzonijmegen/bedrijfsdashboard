import { auth } from "@clerk/nextjs";
import { redirect } from "next/navigation";

export default function Home() {
  const { sessionClaims } = auth();
  const email = sessionClaims?.email as string | undefined;

  if (!email) {
    redirect("/sign-in");
  } else if (email === "herman@ijssalonvincenzo.nl") {
    redirect("/admin");
  } else {
    redirect("/instructies");
  }
}
