// src/app/api/allergenen/receptniveau/route.ts

import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const result = await db.query(
    `SELECT DISTINCT pa.product_id, pa.allergeen
     FROM product_allergenen pa`
  );

  return NextResponse.json(result.rows);
}
