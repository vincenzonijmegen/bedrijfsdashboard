import { NextRequest, NextResponse } from "next/server";
import { berekenHoldingsMeerjaren } from "@/lib/cashflow/berekenHoldingsMeerjaren";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function round2(v: number) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

function parseYear(value: string | null) {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 2027 || year > 2035) {
    throw new Error("jaar moet tussen 2027 en 2035 liggen");
  }
  return year;
}

function parseToYear(value: string | null, year: number) {
  const toYear = Number(value ?? year + 1);
  if (!Number.isInteger(toYear) || toYear < year + 1 || toYear > 2036) {
    throw new Error("tot moet minimaal jaar + 1 zijn en maximaal 2036");
  }
  return toYear;
}

function parseOptionalMoney(value: string | null, name: string) {
  if (value == null || value.trim() === "") return 0;
  const n = Number(value.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${name} is ongeldig`);
  }
  return round2(n);
}

type BonusInput = {
  person: "Robert" | "Emo";
  entity: "Eetje Pans Holding B.V." | "Rekka Holding B.V.";
  gross: number;
  net: number;
  payrollReturn: number;
};

function readBonus(
  url: URL,
  person: "Robert" | "Emo",
  entity: BonusInput["entity"]
): BonusInput {
  const prefix = person.toLowerCase();
  const gross = parseOptionalMoney(
    url.searchParams.get(`${prefix}_bruto`),
    `${person} bruto`
  );
  const net = parseOptionalMoney(
    url.searchParams.get(`${prefix}_netto`),
    `${person} netto`
  );
  const payrollReturn = parseOptionalMoney(
    url.searchParams.get(`${prefix}_loonaangifte`),
    `${person} loonaangifte`
  );

  if (gross > 20000) {
    throw new Error(`${person} bruto bonus mag maximaal €20.000 zijn`);
  }

  const anyFilled = gross > 0 || net > 0 || payrollReturn > 0;
  if (anyFilled && gross <= 0) {
    throw new Error(`${person} bruto bonus ontbreekt`);
  }
  if (gross > 0 && (net <= 0 || payrollReturn <= 0)) {
    throw new Error(
      `${person}: bij een bonus zijn netto en loonaangifte verplicht`
    );
  }
  if (net > gross) {
    throw new Error(`${person}: netto bonus kan niet hoger zijn dan bruto`);
  }

  return { person, entity, gross, net, payrollReturn };
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const year = parseYear(url.searchParams.get("jaar"));
    const toYear = parseToYear(url.searchParams.get("tot"), year);

    const bonuses: BonusInput[] = [
      readBonus(url, "Robert", "Eetje Pans Holding B.V."),
      readBonus(url, "Emo", "Rekka Holding B.V."),
    ];

    if (!bonuses.some((b) => b.gross > 0)) {
      throw new Error("Vul minimaal één bruto bonus in");
    }
    if (year < 2028 && bonuses.find((b) => b.person === "Emo")!.gross > 0) {
      throw new Error(
        "Emo kan in dit basisscenario pas vanaf 2028 een eindejaarsbonus krijgen"
      );
    }

    const base = await berekenHoldingsMeerjaren(toYear);

    if (!base.available) {
      return NextResponse.json({
        success: true,
        fase: "4I-B3",
        data: {
          available: false,
          reason: "Basisberekening holdings is niet volledig beschikbaar",
        },
      });
    }

    const scenarios = bonuses
      .filter((bonus) => bonus.gross > 0)
      .map((bonus) => {
        const holdingBase = base.holdings.find(
          (h) => h.entity === bonus.entity
        );
        if (!holdingBase || !holdingBase.available) {
          throw new Error(`${bonus.entity} is niet volledig beschikbaar`);
        }

        const scenario = structuredClone(holdingBase);
        const dec = scenario.months.find(
          (m) => m.year === year && m.month === 12
        );
        const jan = scenario.months.find(
          (m) => m.year === year + 1 && m.month === 1
        );
        if (!dec || !jan) {
          throw new Error(
            `December ${year} of januari ${year + 1} ontbreekt in de prognose`
          );
        }

        const extraFeeExVat = bonus.gross;
        const extraVat = round2(bonus.gross * 0.21);
        const extraFeeInclVat = round2(bonus.gross + extraVat);

        // December: Vincenzo betaalt de bruto bonus als extra managementfee
        // exclusief btw door; de holding betaalt de netto bonus aan de werknemer.
        dec.income = round2(dec.income + extraFeeInclVat);
        dec.expenses = round2(dec.expenses + bonus.net);
        dec.lines.push({
          streamId: bonus.person === "Robert" ? -201 : -211,
          name: `Scenario extra managementfee bonus ${bonus.person}`,
          category: "scenario_managementfee_bonus",
          direction: "in",
          amount: extraFeeInclVat,
          vatPart: extraVat,
          source: "scenario_4I_B3",
        });
        dec.lines.push({
          streamId: bonus.person === "Robert" ? -202 : -212,
          name: `Scenario netto eindejaarsbonus ${bonus.person}`,
          category: "scenario_werknemer_bonus_netto",
          direction: "uit",
          amount: bonus.net,
          vatPart: 0,
          source: "scenario_4I_B3",
        });

        // Januari: loonheffing/Zvw over de bonus en btw over de extra
        // managementfee worden betaald.
        jan.expenses = round2(
          jan.expenses + bonus.payrollReturn + extraVat
        );
        jan.lines.push({
          streamId: bonus.person === "Robert" ? -203 : -213,
          name: `Scenario loonaangifte eindejaarsbonus ${bonus.person}`,
          category: "scenario_werknemer_bonus_loonaangifte",
          direction: "uit",
          amount: bonus.payrollReturn,
          vatPart: 0,
          source: "scenario_4I_B3",
        });

        const vatLine = jan.lines.find(
          (line) =>
            line.category === "btw" &&
            line.name === `BTW Q4 ${year}` &&
            line.direction === "uit" &&
            line.amount != null
        );

        if (vatLine && vatLine.amount != null) {
          vatLine.amount = round2(Number(vatLine.amount) + extraVat);
          vatLine.source = "model + scenario_4I_B3";
        } else {
          jan.lines.push({
            streamId: bonus.person === "Robert" ? -204 : -214,
            name: `Extra BTW Q4 ${year} door bonus ${bonus.person}`,
            category: "btw",
            direction: "uit",
            amount: extraVat,
            vatPart: 0,
            source: "scenario_4I_B3",
          });
        }

        // Alles opnieuw doorrollen zodat het scenario-effect in latere jaren blijft staan.
        let running = scenario.startBalance;
        let lowestBalance: number | null = null;
        let lowestYear: number | null = null;
        let lowestMonth: number | null = null;

        for (const month of scenario.months) {
          month.beginningBalance = running;
          month.cashChange = round2(month.income - month.expenses);
          month.endingBalance =
            running == null ? null : round2(running + month.cashChange);
          month.belowMinimum =
            month.endingBalance == null || month.minimumBuffer == null
              ? null
              : month.endingBalance < month.minimumBuffer;
          running = month.endingBalance;

          if (
            month.endingBalance != null &&
            (lowestBalance == null || month.endingBalance < lowestBalance)
          ) {
            lowestBalance = month.endingBalance;
            lowestYear = month.year;
            lowestMonth = month.month;
          }
        }

        scenario.lowestBalance = lowestBalance;
        scenario.lowestYear = lowestYear;
        scenario.lowestMonth = lowestMonth;
        scenario.endingBalance = running;

        const baseDec = holdingBase.months.find(
          (m) => m.year === year && m.month === 12
        )!;
        const baseJan = holdingBase.months.find(
          (m) => m.year === year + 1 && m.month === 1
        )!;

        const expectedLongRunDelta = round2(
          bonus.gross - bonus.net - bonus.payrollReturn
        );
        const actualLongRunDelta = round2(
          Number(jan.endingBalance) - Number(baseJan.endingBalance)
        );

        return {
          person: bonus.person,
          entity: bonus.entity,
          input: {
            year,
            grossBonus: bonus.gross,
            netBonus: bonus.net,
            payrollReturn: bonus.payrollReturn,
          },
          managementFee: {
            extraExVat: extraFeeExVat,
            vat: extraVat,
            extraInclVat: extraFeeInclVat,
          },
          december: {
            key: monthKey(year, 12),
            baselineEndingBalance: baseDec.endingBalance,
            scenarioEndingBalance: dec.endingBalance,
            balanceDelta: round2(
              Number(dec.endingBalance) - Number(baseDec.endingBalance)
            ),
            scenarioLines: dec.lines.filter((line) =>
              String(line.source).includes("scenario_4I_B3")
            ),
          },
          january: {
            key: monthKey(year + 1, 1),
            baselineEndingBalance: baseJan.endingBalance,
            scenarioEndingBalance: jan.endingBalance,
            balanceDelta: actualLongRunDelta,
            scenarioLines: jan.lines.filter((line) =>
              String(line.source).includes("scenario_4I_B3")
            ),
          },
          validation: {
            expectedDecemberDelta: round2(extraFeeInclVat - bonus.net),
            expectedLongRunDelta,
            actualLongRunDelta,
            matchesExpectedLongRunDelta:
              actualLongRunDelta === expectedLongRunDelta,
          },
          forecast: {
            lowestBalance: scenario.lowestBalance,
            lowestYear: scenario.lowestYear,
            lowestMonth: scenario.lowestMonth,
            endingBalance: scenario.endingBalance,
          },
        };
      });

    return NextResponse.json({
      success: true,
      fase: "4I-B3",
      data: {
        available: true,
        scenario: "Optionele eindejaarsbonus",
        rules: {
          month: 12,
          maxGrossPerPerson: 20000,
          managementFeeIncreaseEqualsGrossExVat: true,
          vatPercentage: 21,
          payrollReturnPaidInFollowingJanuary: true,
          bonusStoredInBaseForecast: false,
        },
        scenarios,
        summary: {
          year,
          persons: scenarios.map((s) => s.person),
          totalGrossBonus: round2(
            scenarios.reduce((sum, s) => sum + s.input.grossBonus, 0)
          ),
          allValidationsClean: scenarios.every(
            (s) => s.validation.matchesExpectedLongRunDelta
          ),
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        fase: "4I-B3",
        error: String(error),
      },
      { status: 400 }
    );
  }
}
