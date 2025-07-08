// src/app/api/admin/skillsstatus/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  const { rows } = await db.query(
    `SELECT email,
            SUM(CASE WHEN status='geleerd' THEN 1 ELSE 0 END) AS learned,
            COUNT(*) AS total
     FROM skills_status
     GROUP BY email`
  );
  return NextResponse.json(rows);
}
