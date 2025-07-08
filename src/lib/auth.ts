import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

const JWT_SECRET = process.env.JWT_SECRET!;
if (!JWT_SECRET) throw new Error("JWT_SECRET ontbreekt");

export function verifyJWT(req: NextRequest) {
  const token = req.cookies.get("sessie_token")?.value;
  if (!token) throw new Error("Geen sessie");

  const payload = jwt.verify(token, JWT_SECRET) as {
    email: string;
    naam?: string;
    functie?: string;
  };

  return payload;
}
