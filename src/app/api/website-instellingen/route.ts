import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type SeasonMode = "winter" | "march" | "summer";
type RecruitmentMode = "closed" | "summer";
type IncidentMode = "none" | "closed_today" | "closed_from";

type WinterConfig = {
  active?: boolean;
  reopenText: string;
  topbarText: string;
  heroLabel: string;
  heroStatus: string;
  heroText: string;
  photoText: string;
  locationTitle: string;
  locationText: string;
};

type WebsiteConfig = {
  season: { mode: SeasonMode };
  incident: {
    mode: IncidentMode;
    date?: string;
    closeFrom: string;
  };
  winter: WinterConfig;
  recruitment: {
    mode: RecruitmentMode;
    closedTitle: string;
    closedText: string;
    summerTitle: string;
    summerText: string;
  };
};

function getSyncSettings() {
  const url = process.env.WEBSITE_SYNC_URL?.trim();
  const token = process.env.WEBSITE_SYNC_TOKEN?.trim();

  if (!url || !token) {
    throw new Error(
      "WEBSITE_SYNC_URL en/of WEBSITE_SYNC_TOKEN ontbreken in de Vercel environment variables."
    );
  }

  return { url, token };
}

async function cloud86Fetch(init: RequestInit = {}) {
  const { url, token } = getSyncSettings();

  return fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "X-Vincenzo-Token": token,
      ...(init.headers || {}),
    },
  });
}

async function readJsonResponse(response: Response) {
  const text = await response.text();

  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(
      `Cloud86 gaf geen geldige JSON terug (HTTP ${response.status}).`
    );
  }
}

export async function GET() {
  try {
    const response = await cloud86Fetch({ method: "GET" });
    const data = await readJsonResponse(response);

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error || "Website-instellingen konden niet worden opgehaald." },
        { status: response.status }
      );
    }

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Website-instellingen GET:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Onbekende fout bij ophalen website-instellingen.",
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as WebsiteConfig;
    const seasonModes: SeasonMode[] = ["winter", "march", "summer"];
    const incidentModes: IncidentMode[] = ["none", "closed_today", "closed_from"];
    const recruitmentModes: RecruitmentMode[] = ["closed", "summer"];

    if (
      !body?.season ||
      !seasonModes.includes(body.season.mode) ||
      !body?.incident ||
      !incidentModes.includes(body.incident.mode) ||
      (body.incident.mode === "closed_from" && !/^\d{2}:\d{2}$/.test(body.incident.closeFrom || "")) ||
      !body?.winter ||
      !body?.recruitment ||
      !recruitmentModes.includes(body.recruitment.mode)
    ) {
      return NextResponse.json(
        { error: "Ongeldige website-instellingen." },
        { status: 400 }
      );
    }

    const response = await cloud86Fetch({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await readJsonResponse(response);

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error || "Publiceren naar Cloud86 is mislukt." },
        { status: response.status }
      );
    }

    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Website-instellingen PUT:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Onbekende fout bij publiceren website-instellingen.",
      },
      { status: 500 }
    );
  }
}
