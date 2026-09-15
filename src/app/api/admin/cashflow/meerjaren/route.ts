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
        fase: "4R-A",
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
        controle4OB: {
          betaalmaandVolgendJaar:
            data.instellingen?.vpb?.betaalmaandVolgendJaar ?? null,
          basisjaar: {
            jaar: data.basisjaar?.jaar ?? null,
            geraamdeVpb: data.basisjaar?.vpbPlanning?.geraamdeVpb ?? null,
            startMaandFiscaal:
              data.basisjaar?.vpbPlanning
                ? (data.basisjaar.jaar === 2026 ? 4 : 1)
                : null,
          },
          betalingen: Array.isArray(data.jaren)
            ? data.jaren.map((j) => {
                const maand = Array.isArray(j.maanden)
                  ? j.maanden.find(
                      (m) =>
                        m.maand ===
                        (data.instellingen?.vpb?.betaalmaandVolgendJaar ?? 8)
                    )
                  : null;
                return {
                  betaaljaar: j.jaar,
                  betreftJaar: j.jaar - 1,
                  maand: maand?.maand ?? null,
                  bedrag:
                    maand?.vpbKasMutatie == null
                      ? null
                      : Math.abs(maand.vpbKasMutatie),
                };
              })
            : [],
        },
        controle4RA: {
          methode: data.instellingen?.vpb?.methode ?? null,
          referentieJaar: data.instellingen?.vpb?.referentieJaar ?? null,
          referentieOpbrengsten:
            data.instellingen?.vpb?.referentieOpbrengsten ?? null,
          referentieWinst: data.instellingen?.vpb?.referentieWinst ?? null,
          referentieWinstmargePct:
            data.instellingen?.vpb?.referentieWinstmargePct ?? null,
          basisjaar: {
            jaar: data.basisjaar?.jaar ?? null,
            omzetExBtw: data.basisjaar?.vpbPlanning?.omzetExBtw ?? null,
            cashflowModelBelastbaarBedragVoorCorrecties:
              data.basisjaar?.vpbPlanning
                ?.cashflowModelBelastbaarBedragVoorCorrecties ?? null,
            referentieWinstVoorManagementfees:
              data.basisjaar?.vpbPlanning
                ?.referentieWinstVoorManagementfees ?? null,
            managementfeesFiscaal:
              data.basisjaar?.vpbPlanning?.managementfeesFiscaal ?? null,
            managerCorrectieWinst:
              data.basisjaar?.vpbPlanning?.managerCorrectieWinst ?? null,
            belastbaarBedragVoorCorrecties:
              data.basisjaar?.vpbPlanning?.belastbaarBedragVoorCorrecties ?? null,
            geraamdeVpb: data.basisjaar?.vpbPlanning?.geraamdeVpb ?? null,
          },
          jaren: Array.isArray(data.jaren)
            ? data.jaren.map((j) => ({
                jaar: j.jaar,
                omzetExBtw: j.vpbPlanning?.omzetExBtw ?? null,
                cashflowModelBelastbaarBedragVoorCorrecties:
                  j.vpbPlanning
                    ?.cashflowModelBelastbaarBedragVoorCorrecties ?? null,
                referentieWinstVoorManagementfees:
                  j.vpbPlanning?.referentieWinstVoorManagementfees ?? null,
                managementfeesFiscaal:
                  j.vpbPlanning?.managementfeesFiscaal ?? null,
                managerCorrectieWinst:
                  j.vpbPlanning?.managerCorrectieWinst ?? null,
                belastbaarBedragVoorCorrecties:
                  j.vpbPlanning?.belastbaarBedragVoorCorrecties ?? null,
                geraamdeVpb: j.vpbPlanning?.geraamdeVpb ?? null,
              }))
            : [],
        },
        controle4QA: {
          leerbasis: data.loonkostenModel?.leerbasis ?? null,
          personeelsUurkosten:
            data.loonkostenModel?.personeelsUurkosten ?? null,
          managerAannames:
            data.loonkostenModel?.managerAannames ?? null,
          jaren: Array.isArray(data.jaren)
            ? data.jaren.map((j) => ({
                jaar: j.jaar,
                loonkostenTotaal: Math.round(
                  j.maanden.reduce(
                    (som, m) => som + Number(m.loonkosten ?? 0),
                    0
                  ) * 100
                ) / 100,
                managerCorrectieTotaal: Math.round(
                  j.maanden.reduce(
                    (som, m) => som + Number(m.managerCorrectie ?? 0),
                    0
                  ) * 100
                ) / 100,
                bronnen: [
                  ...new Set(j.maanden.map((m) => m.loonkostenBron)),
                ],
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
      { success: false, fase: "4R-A", error: String(error) },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
