import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{
    email: string;
  }>;
};

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const { email } = await params;
    const body = await req.json();

    const eersteWerkdag =
      typeof body.eerste_werkdag === "string" && body.eerste_werkdag.trim()
        ? body.eerste_werkdag.trim()
        : null;

    const { rows } = await db.query(
      `
        UPDATE medewerkers
        SET eerste_werkdag = $1::date
        WHERE email = $2
        RETURNING email, eerste_werkdag
      `,
      [eersteWerkdag, decodeURIComponent(email)]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: "Medewerker niet gevonden",
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      item: rows[0],
    });
  } catch (error) {
    console.error("Fout bij opslaan eerste werkdag:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Eerste werkdag opslaan mislukt",
      },
      { status: 500 }
    );
  }
}