// src/app/api/shiftbase/medewerkers/route.ts
import { NextRequest, NextResponse } from "next/server";

if (process.env.NODE_ENV === "development") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

export async function GET(req: NextRequest) {
  const rawKey = process.env.SHIFTBASE_API_KEY;
  const apiKey = rawKey?.trim() || "";
  const authHeader = `API ${apiKey}`;

  const depUrl = "https://api.shiftbase.com/api/departments";

  try {
    // 1. Haal alle afdelingen op
    const depRes = await fetch(depUrl, {
      headers: {
        Authorization: authHeader,
        Accept: "application/json",
      },
    });

    if (!depRes.ok) {
      const msg = await depRes.text();
      return NextResponse.json({ error: "Fout bij ophalen afdelingen", details: msg }, { status: depRes.status });
    }

    const depData = await depRes.json();
    const departments = depData.data || [];

    // 2. Haal per afdeling de medewerkers op
    const alleMedewerkers = [];

    for (const dep of departments) {
      const id = dep.Department?.id;
      const naam = dep.Department?.name || "?";
      if (!id) continue;

      const empRes = await fetch(`https://api.shiftbase.com/api/hr/departments/${id}/employeeList`, {
        headers: {
          Authorization: authHeader,
          Accept: "application/json",
        },
      });

      if (empRes.ok) {
        const empData = await empRes.json();
        const metDept = (empData.data || []).map((e: any) => ({ ...e, department_name: naam }));
        alleMedewerkers.push(...metDept);
      }
    }

    return NextResponse.json({ data: alleMedewerkers });
  } catch (err) {
    console.error("Fout in gecombineerde medewerkersroute:", err);
    return NextResponse.json({ error: "Serverfout", details: String(err) }, { status: 500 });
  }
}
