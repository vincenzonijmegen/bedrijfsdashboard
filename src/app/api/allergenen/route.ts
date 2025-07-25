// src/app/api/allergenen/route.ts

import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const productId = req.nextUrl.searchParams.get("product_id");
  if (!productId) return NextResponse.json({ error: "product_id vereist" }, { status: 400 });

  const result = await db.query(
    `SELECT allergeen FROM product_allergenen WHERE product_id = $1`,
    [productId]
  );

  return NextResponse.json(result.rows.map(r => r.allergeen));
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { product_id, allergenen }: { product_id: number, allergenen: string[] } = body;

  if (!product_id || !Array.isArray(allergenen)) {
    return NextResponse.json({ error: "Ongeldige invoer" }, { status: 400 });
  }

  await db.query(`DELETE FROM product_allergenen WHERE product_id = $1`, [product_id]);

  for (const a of allergenen) {
    await db.query(`INSERT INTO product_allergenen (product_id, allergeen) VALUES ($1, $2)`, [product_id, a]);
  }

  return NextResponse.json({ status: "ok" });
}
