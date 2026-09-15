import { NextRequest, NextResponse } from "next/server";
import { berekenVincenzoMeerjaren } from "@/lib/cashflow/berekenVincenzoMeerjaren";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const huidigJaar = new Date().getFullYear();
    const totJaar = Number(url.searchParams.get("tot") ?? huidigJaar + 3);

    if (!Number.isInteger(totJaar)) {
      return NextResponse.json(
        { success: false, error: "Ongeldig eindjaar" },
        { status: 400 }
      );
    }

    const data = await berekenVincenzoMeerjaren(totJaar);
    const grens = data.basisjaar?.prognoseGrens ?? null;
    const herijking = data.basisjaar?.herijking ?? null;

    return NextResponse.json(
      {
        success: true,
        fase: "4O-A",
        controle4NA: {
          prognoseGrensAanwezig: grens !== null,
          peildatum: grens?.peildatum ?? null,
          afgeslotenTotMaand: grens?.afgeslotenTotMaand ?? null,
          eerstePrognoseMaand: grens?.eerstePrognoseMaand ?? null,
        },
        controle4NB: {
          herijkingAanwezig: herijking !== null,
          peildatum: herijking?.peildatum ?? null,
          omzetWerkelijkMaanden: herijking?.omzetWerkelijkMaanden ?? [],
          omzetPrognoseMaanden: herijking?.omzetPrognoseMaanden ?? [],
          loonkostenWerkelijkMaanden:
            herijking?.loonkostenWerkelijkMaanden ?? [],
          loonkostenPrognoseMaanden:
            herijking?.loonkostenPrognoseMaanden ?? [],
          toekomstigeJarenGebruikenHerijkteBasis:
            herijking?.toekomstigeJarenGebruikenHerijkteBasis ?? false,
        },
        controle4OA: {
          vpbPlanningAanwezig:
            Array.isArray(data.jaren) &&
            data.jaren.length > 0 &&
            data.jaren.every((j) => j.vpbPlanning !== null),
          tariefBronJaar: data.instellingen?.vpb?.tariefBronJaar ?? null,
          drempel: data.instellingen?.vpb?.drempel ?? null,
          laagPct: data.instellingen?.vpb?.laagPct ?? null,
          hoogPct: data.instellingen?.vpb?.hoogPct ?? null,
          kasEffectActief: data.instellingen?.vpb?.kasEffectActief ?? null,
          jaren: Array.isArray(data.jaren)
            ? data.jaren.map((j) => ({
                jaar: j.jaar,
                belastbaarBedragVoorCorrecties:
                  j.vpbPlanning?.belastbaarBedragVoorCorrecties ?? null,
                geraamdeVpb: j.vpbPlanning?.geraamdeVpb ?? null,
              }))
            : [],
        },
        data,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("[/api/admin/cashflow/meerjaren] error:", error);
    return NextResponse.json(
      { success: false, fase: "4O-A", error: String(error) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
