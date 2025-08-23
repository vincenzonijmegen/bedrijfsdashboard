import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) throw new Error("JWT_SECRET ontbreekt");

export function verifyJWT(req: NextRequest) {
  const token = req.cookies.get("sessie_token")?.value;
  if (!token) {
    console.warn("⚠️ Geen sessie_token cookie ontvangen");
    throw new Error("Geen sessie");
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as {
      email: string;
      naam?: string;
      functie?: string;
      rol?: string;
    };
    return payload;
  } catch (err) {
    console.error("❌ JWT-verificatie mislukt:", err);
    throw new Error("JWT ongeldig");
  }
}
