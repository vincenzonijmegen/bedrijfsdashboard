import { NextResponse } from "next/server";

const SHIFTBASE_BASE = "https://api.shiftbase.com/api/contracts";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: Request) {
  const apiKey = process.env.SHIFTBASE_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "SHIFTBASE_API_KEY ontbreekt" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);

  // Basis-URL + bestaande query’s doorzetten
  const baseUrl = new URL(SHIFTBASE_BASE);
  searchParams.forEach((v, k) => baseUrl.searchParams.set(k, v));

  // Voor paginering: forceer een royale page_size, val anders terug op loop
  if (!baseUrl.searchParams.has("page_size")) baseUrl.searchParams.set("page_size", "500");

  // Sommige API's gebruiken page/per_page; andere page_size. We vangen beide af.
  let page = Number(baseUrl.searchParams.get("page") || "1");
  baseUrl.searchParams.set("page", String(page));

  const all: any[] = [];
  let safety = 0;

  try {
    // loop tot er geen data meer is (of safety break)
    // NB: Shiftbase kan meta hebben zonder paging info; daarom stoppen we op lege data.
    // Pas evt. aan als je weet hoe hun meta-paging heet (bijv. meta.next_page).
    do {
      const url = new URL(baseUrl.toString());
      url.searchParams.set("page", String(page));

      const res = await fetch(url.toString(), {
        method: "GET",
        headers: {
          Accept: "application/json",
          Authorization: apiKey,
        },
        cache: "no-store",
      });

      const jsonText = await res.text();
      if (!res.ok) {
        return NextResponse.json(
          { error: `Shiftbase responded ${res.status}`, body: safeJson(jsonText) },
          { status: res.status }
        );
      }

      const json = safeJson(jsonText) as any;
      const rows: any[] = Array.isArray(json?.data) ? json.data : [];
      all.push(...rows);

      // stopconditie
      if (rows.length === 0) break;

      page += 1;
      safety += 1;
    } while (safety < 50); // hard safety

    return NextResponse.json({ data: all });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Fetch naar Shiftbase mislukt", detail: String(err?.message ?? err) },
      { status: 502 }
    );
  }
}

function safeJson(s: string) {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
