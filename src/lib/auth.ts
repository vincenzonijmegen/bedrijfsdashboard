import { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      authorize(credentials) {
        // dummy login
        if (credentials?.email === "admin@vincenzo.nl") {
          return { id: "1", name: "Herman", email: "admin@vincenzo.nl" };
        }
        return null;
      }
    })
  ],
  pages: {
    signIn: "/login"
  }
};
