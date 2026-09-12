import { NextRequest, NextResponse } from "next/server";
import { berekenHoldingsMeerjaren } from "@/lib/cashflow/berekenHoldingsMeerjaren";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const PRIVATE_CATEGORIES = new Set([
  "vrije_reserve",
  "dividend",
  "dividendbelasting",
]);

export async function GET(req: NextRequest) {
  try {
    const currentYear = new Date().getFullYear();
    const url = new URL(req.url);
    const toYear = Number(url.searchParams.get("tot") || currentYear + 3);

    const data = await berekenHoldingsMeerjaren(toYear);

    const alerts: Array<{
      entity: string;
      year: number;
      month: number;
      minimumBuffer: number;
      endingBalance: number;
      endingBalanceWithoutPrivateWithdrawal: number;
      targetPrivateNet: number;
      holdingCashCost: number;
      linkedFreeRoomRepayment: number;
      linkedDividendFunding: number;
      netHoldingImpact: number;
      bufferShortfall: number;
      type: "opname_breekt_buffer" | "opname_vergroot_buffertekort";
      canAvoidBreachByPostponing: boolean;
      action: "uitstellen";
    }> = [];

    for (const holding of data.holdings) {
      for (const month of holding.months) {
        if (
          month.endingBalance == null ||
          month.minimumBuffer == null
        ) {
          continue;
        }

        const privateLines = month.lines.filter(
          (line) =>
            line.direction === "uit" &&
            PRIVATE_CATEGORIES.has(line.category) &&
            line.amount != null
        );

        if (!privateLines.length) continue;

        const holdingCashCost = round2(
          privateLines.reduce((sum, line) => sum + Number(line.amount ?? 0), 0)
        );

        if (holdingCashCost <= 0) continue;

        const freeRoomPart = round2(
          privateLines
            .filter((line) => line.category === "vrije_reserve")
            .reduce((sum, line) => sum + Number(line.amount ?? 0), 0)
        );

        const linkedFreeRoomRepayment = round2(
          month.lines
            .filter(
              (line) =>
                line.direction === "in" &&
                line.category === "aflossing_vincenzo_vrije_ruimte" &&
                line.amount != null
            )
            .reduce((sum, line) => sum + Number(line.amount ?? 0), 0)
        );

        const linkedDividendFunding = round2(
          month.lines
            .filter(
              (line) =>
                line.direction === "in" &&
                line.category === "dividend_vincenzo_holding" &&
                line.amount != null
            )
            .reduce((sum, line) => sum + Number(line.amount ?? 0), 0)
        );

        const netHoldingImpact = round2(
          holdingCashCost -
            linkedFreeRoomRepayment -
            linkedDividendFunding
        );
        if (netHoldingImpact <= 0) continue;

        const dividendNetAfterBox2 = round2(
          privateLines
            .filter((line) => line.category === "dividend")
            .reduce((sum, line) => sum + Number(line.netAfterBox2 ?? 0), 0)
        );

        const targetPrivateNet = round2(freeRoomPart + dividendNetAfterBox2);
        const endingBalance = Number(month.endingBalance);
        const minimumBuffer = Number(month.minimumBuffer);

        if (endingBalance >= minimumBuffer) continue;

        const endingBalanceWithoutPrivateWithdrawal = round2(
          endingBalance + netHoldingImpact
        );

        const canAvoidBreachByPostponing =
          endingBalanceWithoutPrivateWithdrawal >= minimumBuffer;

        alerts.push({
          entity: holding.entity,
          year: month.year,
          month: month.month,
          minimumBuffer,
          endingBalance: round2(endingBalance),
          endingBalanceWithoutPrivateWithdrawal,
          targetPrivateNet,
          holdingCashCost,
          linkedFreeRoomRepayment,
          linkedDividendFunding,
          netHoldingImpact,
          bufferShortfall: round2(minimumBuffer - endingBalance),
          type: canAvoidBreachByPostponing
            ? "opname_breekt_buffer"
            : "opname_vergroot_buffertekort",
          canAvoidBreachByPostponing,
          action: "uitstellen",
        });
      }
    }

    return NextResponse.json({
      success: true,
      fase: "4I-A",
      data: {
        toYear,
        available: data.available,
        alerts,
        summary: {
          total: alerts.length,
          breaksBuffer: alerts.filter(
            (a) => a.type === "opname_breekt_buffer"
          ).length,
          worsensExistingShortfall: alerts.filter(
            (a) => a.type === "opname_vergroot_buffertekort"
          ).length,
          entities: [...new Set(alerts.map((a) => a.entity))],
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        fase: "4I-A",
        error: String(error),
      },
      { status: 500 }
    );
  }
}
