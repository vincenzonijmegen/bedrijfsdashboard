import { NextRequest, NextResponse } from "next/server";
import { berekenHoldingsMeerjaren } from "@/lib/cashflow/berekenHoldingsMeerjaren";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function round2(v: number) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

function parseMoney(value: string | null, name: string) {
  if (value == null || value.trim() === "") {
    throw new Error(`${name} ontbreekt`);
  }
  const n = Number(value.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${name} is ongeldig`);
  }
  return round2(n);
}

function parseOptionalNumber(value: string | null, name: string) {
  if (value == null || value.trim() === "") return null;
  const n = Number(value.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${name} is ongeldig`);
  }
  return n;
}

function parseStartMonth(value: string | null) {
  const s = String(value ?? "");
  if (!/^2027-(0[1-9]|1[0-2])$/.test(s)) {
    throw new Error("start moet een maand in 2027 zijn, formaat YYYY-MM");
  }
  return Number(s.slice(5, 7));
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function nextMonth(year: number, month: number) {
  if (month === 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}

function vatPayMonth(year: number, quarter: number) {
  if (quarter === 1) return { year, month: 4 };
  if (quarter === 2) return { year, month: 7 };
  if (quarter === 3) return { year, month: 10 };
  return { year: year + 1, month: 1 };
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const toYear = Number(url.searchParams.get("tot") ?? 2029);
    const startMonth = parseStartMonth(url.searchParams.get("start"));
    const gross = parseMoney(url.searchParams.get("bruto"), "bruto");
    const net = parseMoney(url.searchParams.get("netto"), "netto");
    const payrollReturn = parseMoney(
      url.searchParams.get("loonaangifte"),
      "loonaangifte"
    );
    const hoursPerWeek = parseOptionalNumber(
      url.searchParams.get("uren"),
      "uren"
    );

    if (!Number.isInteger(toYear) || toYear < 2027 || toYear > 2036) {
      throw new Error("tot moet tussen 2027 en 2036 liggen");
    }
    if (gross > 3000) {
      throw new Error("bruto mag in dit 2027-scenario niet hoger zijn dan €3.000");
    }

    const base = await berekenHoldingsMeerjaren(toYear);
    const rekkaBase = base.holdings.find(
      (h) => h.entity === "Rekka Holding B.V."
    );
    const eetjeBase = base.holdings.find(
      (h) => h.entity === "Eetje Pans Holding B.V."
    );

    if (!rekkaBase || !eetjeBase) {
      throw new Error("Holdings ontbreken in de basisberekening");
    }
    if (!rekkaBase.available || !eetjeBase.available) {
      return NextResponse.json({
        success: true,
        fase: "4I-B2",
        data: {
          available: false,
          reason: "Basisberekening holdings is niet volledig beschikbaar",
          baseAvailable: base.available,
        },
      });
    }

    const scenario = structuredClone(rekkaBase);
    const months = scenario.months;
    const grossFeeCash = round2(gross * 1.21);
    const monthlyVat = round2(gross * 0.21);

    const affected = new Map<
      string,
      { incomeDelta: number; expenseDelta: number; reasons: string[] }
    >();

    function mark(
      year: number,
      month: number,
      incomeDelta: number,
      expenseDelta: number,
      reason: string
    ) {
      const key = monthKey(year, month);
      const prev = affected.get(key) ?? {
        incomeDelta: 0,
        expenseDelta: 0,
        reasons: [],
      };
      prev.incomeDelta = round2(prev.incomeDelta + incomeDelta);
      prev.expenseDelta = round2(prev.expenseDelta + expenseDelta);
      prev.reasons.push(reason);
      affected.set(key, prev);
    }

    function getMonth(year: number, month: number) {
      const row = months.find((m) => m.year === year && m.month === month);
      if (!row) throw new Error(`Maand ${monthKey(year, month)} ontbreekt`);
      return row;
    }

    // 2027: managementfee-opslag en netto loon vanaf de gekozen startmaand.
    for (let month = startMonth; month <= 12; month++) {
      const row = getMonth(2027, month);

      row.income = round2(row.income + grossFeeCash);
      row.expenses = round2(row.expenses + net);
      row.lines.push({
        streamId: -101,
        name: "Scenario managementfee Emo 2027",
        category: "scenario_managementfee",
        direction: "in",
        amount: grossFeeCash,
        vatPart: monthlyVat,
        source: "scenario_4I_B2",
      });
      row.lines.push({
        streamId: -102,
        name: "Scenario netto loon Emo 2027",
        category: "scenario_werknemer_netto_loon",
        direction: "uit",
        amount: net,
        vatPart: 0,
        source: "scenario_4I_B2",
      });
      mark(
        2027,
        month,
        grossFeeCash,
        net,
        "managementfee + netto loon Emo"
      );

      // Loonaangifte wordt één maand na de loonmaand betaald.
      const pay = nextMonth(2027, month);
      const payRow = getMonth(pay.year, pay.month);
      payRow.expenses = round2(payRow.expenses + payrollReturn);
      payRow.lines.push({
        streamId: -103,
        name: `Scenario loonaangifte Emo over ${monthKey(2027, month)}`,
        category: "scenario_werknemer_loonaangifte",
        direction: "uit",
        amount: payrollReturn,
        vatPart: 0,
        source: "scenario_4I_B2",
      });
      mark(
        pay.year,
        pay.month,
        0,
        payrollReturn,
        `loonaangifte over ${monthKey(2027, month)}`
      );
    }

    // Extra output-btw over de managementfee-opslag wordt per kwartaal betaald.
    for (let quarter = 1; quarter <= 4; quarter++) {
      const qStart = (quarter - 1) * 3 + 1;
      const qEnd = qStart + 2;
      let activeMonths = 0;
      for (let month = qStart; month <= qEnd; month++) {
        if (month >= startMonth) activeMonths++;
      }
      if (!activeMonths) continue;

      const extraVat = round2(activeMonths * monthlyVat);
      const pay = vatPayMonth(2027, quarter);
      const payRow = getMonth(pay.year, pay.month);

      payRow.expenses = round2(payRow.expenses + extraVat);
      const vatLine = payRow.lines.find(
        (line) =>
          line.category === "btw" &&
          line.name === `BTW Q${quarter} 2027` &&
          line.direction === "uit" &&
          line.amount != null
      );
      if (vatLine && vatLine.amount != null) {
        vatLine.amount = round2(Number(vatLine.amount) + extraVat);
        vatLine.source = "model + scenario_4I_B2";
      } else {
        payRow.lines.push({
          streamId: -104,
          name: `Extra BTW Q${quarter} 2027 door scenario Emo`,
          category: "btw",
          direction: "uit",
          amount: extraVat,
          vatPart: 0,
          source: "scenario_4I_B2",
        });
      }
      mark(
        pay.year,
        pay.month,
        0,
        extraVat,
        `extra BTW Q${quarter} 2027`
      );
    }

    // Saldi volledig opnieuw doorrollen zodat ook 2028/2029 het scenario-effect dragen.
    let running = scenario.startBalance;
    let lowestBalance: number | null = null;
    let lowestYear: number | null = null;
    let lowestMonth: number | null = null;

    for (const row of months) {
      row.beginningBalance = running;
      row.cashChange = round2(row.income - row.expenses);
      row.endingBalance =
        running == null ? null : round2(running + row.cashChange);
      row.belowMinimum =
        row.endingBalance == null || row.minimumBuffer == null
          ? null
          : row.endingBalance < row.minimumBuffer;
      running = row.endingBalance;

      if (
        row.endingBalance != null &&
        (lowestBalance == null || row.endingBalance < lowestBalance)
      ) {
        lowestBalance = row.endingBalance;
        lowestYear = row.year;
        lowestMonth = row.month;
      }
    }

    scenario.lowestBalance = lowestBalance;
    scenario.lowestYear = lowestYear;
    scenario.lowestMonth = lowestMonth;
    scenario.endingBalance = running;

    const baseDec2027 = rekkaBase.months.find(
      (m) => m.year === 2027 && m.month === 12
    )?.endingBalance ?? null;
    const scenarioDec2027 = scenario.months.find(
      (m) => m.year === 2027 && m.month === 12
    )?.endingBalance ?? null;
    const eetjeDec2027 = eetjeBase.months.find(
      (m) => m.year === 2027 && m.month === 12
    )?.endingBalance ?? null;

    const affectedMonths = [...affected.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, delta]) => {
        const [year, month] = key.split("-").map(Number);
        const row = scenario.months.find(
          (m) => m.year === year && m.month === month
        )!;
        return {
          year,
          month,
          incomeDelta: delta.incomeDelta,
          expenseDelta: delta.expenseDelta,
          reasons: delta.reasons,
          endingBalance: row.endingBalance,
          belowMinimum: row.belowMinimum,
          lines: row.lines.filter((line) =>
            String(line.source).includes("scenario_4I_B2")
          ),
        };
      });

    const salaryMonths = 13 - startMonth;
    const extraManagementFeeCashTotal = round2(salaryMonths * grossFeeCash);
    const extraManagementFeeExVatTotal = round2(salaryMonths * gross);
    const extraVatTotal = round2(salaryMonths * monthlyVat);
    const totalNetSalary = round2(salaryMonths * net);
    const totalPayrollReturn = round2(salaryMonths * payrollReturn);

    const isRobertEquivalentTest =
      startMonth === 1 &&
      gross === 3000 &&
      net === 2613.17 &&
      payrollReturn === 569.83;

    return NextResponse.json({
      success: true,
      fase: "4I-B2",
      data: {
        available: true,
        scenario: "Emo 2027",
        input: {
          start: `2027-${String(startMonth).padStart(2, "0")}`,
          hoursPerWeek,
          grossMonthly: gross,
          netMonthly: net,
          payrollReturnMonthly: payrollReturn,
        },
        rules: {
          endsOn: "2027-12-31",
          managementFeeIncreaseExVatMonthly: gross,
          managementFeeIncreaseInclVatMonthly: grossFeeCash,
          vatPercentage: 21,
          payrollReturnPaidOneMonthLater: true,
          fixed2028BaseRemainsUntouched: true,
        },
        totals2027Scenario: {
          salaryMonths,
          extraManagementFeeExVatTotal,
          extraManagementFeeCashTotal,
          extraVatTotal,
          totalNetSalary,
          totalPayrollReturn,
        },
        rekka: {
          baselineEnd2027: baseDec2027,
          scenarioEnd2027: scenarioDec2027,
          scenarioLowestBalance: scenario.lowestBalance,
          scenarioLowestYear: scenario.lowestYear,
          scenarioLowestMonth: scenario.lowestMonth,
          scenarioEndingBalance: scenario.endingBalance,
        },
        validation: {
          isRobertEquivalentTest,
          eetjePansEnd2027: eetjeDec2027,
          rekkaScenarioMatchesEetjePansEnd2027:
            isRobertEquivalentTest &&
            scenarioDec2027 != null &&
            eetjeDec2027 != null
              ? round2(scenarioDec2027) === round2(eetjeDec2027)
              : null,
        },
        affectedMonths,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        fase: "4I-B2",
        error: String(error),
      },
      { status: 400 }
    );
  }
}
