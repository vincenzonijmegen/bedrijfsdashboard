import { db } from "@/lib/db";

function round2(v: number) {
  return Math.round(v * 100) / 100;
}

function parseDateOnly(v: unknown) {
  return String(v ?? "").slice(0, 10);
}

function isMonthEnd(dateStr: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate() === d;
}

function monthKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function monthStart(year: number, month: number) {
  return `${monthKey(year, month)}-01`;
}

function addMonths(dateStr: string, amount: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + amount, d));
  return dt.toISOString().slice(0, 10);
}

function frequencyMonths(frequency: string) {
  if (frequency === "maandelijks") return 1;
  if (frequency === "per_kwartaal") return 3;
  if (frequency === "halfjaarlijks") return 6;
  if (frequency === "jaarlijks") return 12;
  return null;
}

function toCashAmount(amount: number, vatPct: number, isInclVat: boolean) {
  if (isInclVat || vatPct <= 0) return round2(amount);
  return round2(amount * (1 + vatPct / 100));
}

function vatPart(cashAmount: number, vatPct: number, isInclVat: boolean, sourceAmount: number) {
  if (vatPct <= 0 || cashAmount <= 0) return 0;
  if (isInclVat) return round2(cashAmount - cashAmount / (1 + vatPct / 100));
  return round2(sourceAmount * vatPct / 100);
}

type Stream = {
  id: number;
  name: string;
  category: string;
  fromEntityId: number | null;
  toEntityId: number | null;
  counterparty: string | null;
  behavior: string;
  postponable: boolean;
  frequency: string;
  startDate: string;
  endDate: string | null;
  sourceStreamId: number | null;
  calculation: "vast_bedrag" | "percentage_van_bron";
  fiscalTreatment: string;
};

type Rate = {
  streamId: number;
  validFrom: string;
  validTo: string | null;
  amount: number | null;
  sourcePercentage: number | null;
  vatPct: number;
  deductiblePct: number;
  isInclVat: boolean;
};

type Plan = {
  streamId: number;
  originalDate: string;
  plannedDate: string;
  amount: number;
  status: string;
  paidOn: string | null;
};

type PlannedEvent = {
  streamId: number;
  originalDate: string;
  actualDate: string;
  amountOverride: number | null;
  status: string;
};

type CashLine = {
  streamId: number;
  name: string;
  category: string;
  direction: "in" | "uit";
  amount: number | null;
  vatPart: number;
  source: string;
  netAfterBox2?: number;
  box2Percentage?: number;
};

type FreeRoom = {
  originalCrediting: number;
  alreadyWithdrawn: number;
  balanceDate: string;
};

type Box2Rate = {
  validFrom: string;
  validTo: string | null;
  effectivePct: number;
};

async function getEntity(name: string) {
  const res = await db.query(`
    SELECT e.id, e.naam, i.minimum_kasbuffer
    FROM cashflow_entiteiten e
    LEFT JOIN cashflow_instellingen i ON i.entiteit_id = e.id
    WHERE e.naam = $1 AND e.actief = true
    LIMIT 1
  `, [name]);
  const row = res.rows?.[0];
  if (!row) throw new Error(`${name} ontbreekt in cashflow_entiteiten`);
  return {
    id: Number(row.id),
    name: String(row.naam),
    minimumBuffer: row.minimum_kasbuffer == null ? null : Number(row.minimum_kasbuffer),
  };
}

async function getAccounts(entityId: number) {
  const res = await db.query(`
    SELECT id, naam, rekening_type, prognose_startsaldo, saldo_peildatum::text AS saldo_peildatum
    FROM cashflow_rekeningen
    WHERE entiteit_id = $1 AND actief = true
    ORDER BY naam
  `, [entityId]);
  return (res.rows ?? []).map((r) => ({
    id: Number(r.id),
    name: String(r.naam),
    type: String(r.rekening_type),
    startBalance: r.prognose_startsaldo == null ? null : Number(r.prognose_startsaldo),
    balanceDate: r.saldo_peildatum == null ? null : parseDateOnly(r.saldo_peildatum),
  }));
}

async function getStreams(entityId: number) {
  const res = await db.query(`
    SELECT id, naam, categorie, van_entiteit_id, naar_entiteit_id, tegenpartij_naam,
           gedrag, uitstelbaar, frequentie, startdatum::text AS startdatum, einddatum::text AS einddatum,
           bron_stroom_id, berekeningswijze, fiscale_behandeling
    FROM cashflow_stromen
    WHERE actief = true
      AND (van_entiteit_id = $1 OR naar_entiteit_id = $1)
    ORDER BY id
  `, [entityId]);
  return (res.rows ?? []).map((r): Stream => ({
    id: Number(r.id),
    name: String(r.naam),
    category: String(r.categorie),
    fromEntityId: r.van_entiteit_id == null ? null : Number(r.van_entiteit_id),
    toEntityId: r.naar_entiteit_id == null ? null : Number(r.naar_entiteit_id),
    counterparty: r.tegenpartij_naam == null ? null : String(r.tegenpartij_naam),
    behavior: String(r.gedrag),
    postponable: Boolean(r.uitstelbaar),
    frequency: String(r.frequentie),
    startDate: parseDateOnly(r.startdatum),
    endDate: r.einddatum == null ? null : parseDateOnly(r.einddatum),
    sourceStreamId: r.bron_stroom_id == null ? null : Number(r.bron_stroom_id),
    calculation: r.berekeningswijze === "percentage_van_bron" ? "percentage_van_bron" : "vast_bedrag",
    fiscalTreatment: String(r.fiscale_behandeling ?? "geen"),
  }));
}

async function getRates(streamIds: number[]) {
  if (!streamIds.length) return new Map<number, Rate[]>();
  const res = await db.query(`
    SELECT stroom_id, geldig_vanaf::text AS geldig_vanaf, geldig_tot::text AS geldig_tot, bedrag, percentage_van_bron,
           btw_percentage, btw_aftrekbaar_percentage, bedrag_is_inclusief_btw
    FROM cashflow_stroom_bedragen
    WHERE stroom_id = ANY($1::int[])
    ORDER BY stroom_id, geldig_vanaf
  `, [streamIds]);
  const map = new Map<number, Rate[]>();
  for (const r of res.rows ?? []) {
    const item: Rate = {
      streamId: Number(r.stroom_id),
      validFrom: parseDateOnly(r.geldig_vanaf),
      validTo: r.geldig_tot == null ? null : parseDateOnly(r.geldig_tot),
      amount: r.bedrag == null ? null : Number(r.bedrag),
      sourcePercentage: r.percentage_van_bron == null ? null : Number(r.percentage_van_bron),
      vatPct: Number(r.btw_percentage) || 0,
      deductiblePct: Number(r.btw_aftrekbaar_percentage) || 0,
      isInclVat: r.bedrag_is_inclusief_btw !== false,
    };
    if (!map.has(item.streamId)) map.set(item.streamId, []);
    map.get(item.streamId)!.push(item);
  }
  return map;
}

async function getPlans(streamIds: number[]) {
  if (!streamIds.length) return new Map<string, Plan>();
  const res = await db.query(`
    SELECT stroom_id, oorspronkelijke_datum::text AS oorspronkelijke_datum, geplande_datum::text AS geplande_datum, bedrag, status, betaald_op::text AS betaald_op
    FROM cashflow_planning
    WHERE stroom_id = ANY($1::int[])
    ORDER BY stroom_id, oorspronkelijke_datum
  `, [streamIds]);
  const map = new Map<string, Plan>();
  for (const r of res.rows ?? []) {
    const p: Plan = {
      streamId: Number(r.stroom_id),
      originalDate: parseDateOnly(r.oorspronkelijke_datum),
      plannedDate: parseDateOnly(r.geplande_datum),
      amount: Number(r.bedrag) || 0,
      status: String(r.status),
      paidOn: r.betaald_op == null ? null : parseDateOnly(r.betaald_op),
    };
    map.set(`${p.streamId}|${p.originalDate}`, p);
  }
  return map;
}

async function getFreeRoom(entityId: number) {
  const res = await db.query(`
    SELECT oorspronkelijke_creditering, reeds_opgenomen, peildatum::text AS peildatum
    FROM cashflow_vrije_ruimte
    WHERE entiteit_id = $1
    LIMIT 1
  `, [entityId]);
  const row = res.rows?.[0];
  if (!row) return null;
  return {
    originalCrediting: Number(row.oorspronkelijke_creditering),
    alreadyWithdrawn: Number(row.reeds_opgenomen),
    balanceDate: parseDateOnly(row.peildatum),
  } satisfies FreeRoom;
}

async function getBox2Rates(entityId: number) {
  const res = await db.query(`
    SELECT geldig_vanaf::text AS geldig_vanaf, geldig_tot::text AS geldig_tot, effectief_percentage
    FROM cashflow_box2_tarieven
    WHERE entiteit_id = $1
    ORDER BY geldig_vanaf
  `, [entityId]);
  return (res.rows ?? []).map((r): Box2Rate => ({
    validFrom: parseDateOnly(r.geldig_vanaf),
    validTo: r.geldig_tot == null ? null : parseDateOnly(r.geldig_tot),
    effectivePct: Number(r.effectief_percentage),
  }));
}

function box2RateForDate(rates: Box2Rate[], date: string) {
  return rates
    .filter((r) => r.validFrom <= date && (r.validTo == null || r.validTo >= date))
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0] ?? null;
}

async function getVatOverrides(entityId: number, fromYear: number, toYear: number) {
  const res = await db.query(`
    SELECT jaar, kwartaal, werkelijke_afdracht, werkelijke_betaaldatum::text AS werkelijke_betaaldatum,
           verwachte_afdracht, geplande_betaaldatum::text AS geplande_betaaldatum, status
    FROM cashflow_btw_kwartalen
    WHERE entiteit_id = $1 AND jaar BETWEEN $2 AND $3
    ORDER BY jaar, kwartaal
  `, [entityId, fromYear, toYear]);
  const map = new Map<string, {
    amount: number | null;
    payDate: string | null;
    source: "werkelijk" | "handmatig_prognose" | null;
  }>();
  for (const r of res.rows ?? []) {
    const key = `${Number(r.jaar)}-${Number(r.kwartaal)}`;
    if (r.werkelijke_afdracht != null) {
      map.set(key, {
        amount: Number(r.werkelijke_afdracht),
        payDate: r.werkelijke_betaaldatum ? parseDateOnly(r.werkelijke_betaaldatum) : null,
        source: "werkelijk",
      });
    } else if (r.verwachte_afdracht != null && String(r.status) !== "betaald") {
      map.set(key, {
        amount: Number(r.verwachte_afdracht),
        payDate: r.geplande_betaaldatum ? parseDateOnly(r.geplande_betaaldatum) : null,
        source: "handmatig_prognose",
      });
    }
  }
  return map;
}

function rateForDate(rates: Map<number, Rate[]>, streamId: number, date: string) {
  const candidates = rates.get(streamId) ?? [];
  return candidates
    .filter((r) => r.validFrom <= date && (r.validTo == null || r.validTo >= date))
    .sort((a, b) => b.validFrom.localeCompare(a.validFrom))[0] ?? null;
}

function streamActiveOn(stream: Stream, date: string) {
  return date >= stream.startDate && (stream.endDate == null || date <= stream.endDate);
}

function isExplicitlyVatFreeStream(stream: Stream) {
  return new Set([
    "dga_netto_loon",
    "dga_loonheffing",
    "werknemer_netto_loon",
    "werknemer_loonaangifte",
    "vrije_reserve",
    "dividend",
    "dividendbelasting",
  ]).has(stream.category);
}

function isDefaultOccurrence(stream: Stream, year: number, month: number) {
  const target = monthStart(year, month);
  if (!streamActiveOn(stream, target)) return false;
  const interval = frequencyMonths(stream.frequency);
  if (stream.frequency === "eenmalig") {
    return stream.startDate.slice(0, 7) === target.slice(0, 7);
  }
  if (interval == null) return false;
  const sy = Number(stream.startDate.slice(0, 4));
  const sm = Number(stream.startDate.slice(5, 7));
  const diff = (year - sy) * 12 + (month - sm);
  return diff >= 0 && diff % interval === 0;
}

function generatePlanEvents(streams: Stream[], plans: Map<string, Plan>, toYear: number) {
  const byMonth = new Map<string, PlannedEvent[]>();
  for (const stream of streams.filter((s) =>
    s.behavior === "planbaar"
    && s.calculation === "vast_bedrag"
    && s.category !== "vrije_reserve"
    && s.category !== "dividend"
  )) {
    const interval = frequencyMonths(stream.frequency);
    if (stream.frequency !== "eenmalig" && interval == null) continue;
    let current = stream.startDate;
    while (Number(current.slice(0, 4)) <= toYear) {
      if (stream.endDate && current > stream.endDate) break;
      const p = plans.get(`${stream.id}|${current}`);
      if (!p || p.status !== "vervallen") {
        const actualDate = p?.status === "betaald" && p.paidOn ? p.paidOn : (p?.plannedDate || current);
        const key = actualDate.slice(0, 7);
        if (!byMonth.has(key)) byMonth.set(key, []);
        byMonth.get(key)!.push({
          streamId: stream.id,
          originalDate: current,
          actualDate,
          amountOverride: p ? p.amount : null,
          status: p?.status ?? "standaard",
        });
      }
      if (stream.frequency === "eenmalig") break;
      current = addMonths(current, interval!);
    }
  }
  return byMonth;
}

function generatePrivateWithdrawalEvents(streams: Stream[], plans: Map<string, Plan>, toYear: number) {
  const byMonth = new Map<string, PlannedEvent[]>();
  for (const stream of streams.filter((s) =>
    s.behavior === "planbaar"
    && s.calculation === "vast_bedrag"
    && s.category === "vrije_reserve"
  )) {
    const interval = frequencyMonths(stream.frequency);
    if (stream.frequency !== "eenmalig" && interval == null) continue;
    let current = stream.startDate;
    while (Number(current.slice(0, 4)) <= toYear) {
      if (stream.endDate && current > stream.endDate) break;
      const p = plans.get(`${stream.id}|${current}`);
      if (!p || p.status !== "vervallen") {
        const actualDate = p?.status === "betaald" && p.paidOn ? p.paidOn : (p?.plannedDate || current);
        const key = actualDate.slice(0, 7);
        if (!byMonth.has(key)) byMonth.set(key, []);
        byMonth.get(key)!.push({
          streamId: stream.id,
          originalDate: current,
          actualDate,
          amountOverride: p ? p.amount : null,
          status: p?.status ?? "standaard",
        });
      }
      if (stream.frequency === "eenmalig") break;
      current = addMonths(current, interval!);
    }
  }
  return byMonth;
}

function vatPaymentDate(year: number, quarter: number) {
  if (quarter === 1) return `${year}-04-30`;
  if (quarter === 2) return `${year}-07-31`;
  if (quarter === 3) return `${year}-10-31`;
  return `${year + 1}-01-31`;
}

async function calculateHolding(entityName: string, toYear: number) {
  const entity = await getEntity(entityName);
  const accounts = await getAccounts(entity.id);
  const missingAccounts = accounts.filter((a) => a.startBalance == null || !a.balanceDate);
  const dateSet = new Set(accounts.map((a) => a.balanceDate).filter(Boolean));
  const commonDate = dateSet.size === 1 ? [...dateSet][0]! : null;
  const startBalance = missingAccounts.length === 0
    ? round2(accounts.reduce((s, a) => s + Number(a.startBalance ?? 0), 0))
    : null;

  const accountProblem = accounts.length === 0
    ? "Geen actieve rekening geconfigureerd"
    : missingAccounts.length
      ? `Startsaldo/peildatum ontbreekt voor: ${missingAccounts.map((a) => a.name).join(", ")}`
      : dateSet.size !== 1
        ? "Actieve rekeningen hebben niet dezelfde peildatum"
        : commonDate && !isMonthEnd(commonDate)
          ? "Peildatum moet een maandultimo zijn"
          : null;

  const streams = await getStreams(entity.id);
  const streamIds = streams.map((s) => s.id);
  const [rates, plans, freeRoom, box2Rates] = await Promise.all([
    getRates(streamIds),
    getPlans(streamIds),
    getFreeRoom(entity.id),
    getBox2Rates(entity.id),
  ]);
  const planEvents = generatePlanEvents(streams, plans, toYear);
  const privateWithdrawalEvents = generatePrivateWithdrawalEvents(streams, plans, toYear);

  const freeRoomProblem = freeRoom == null
    ? "Vrije-ruimteconfiguratie ontbreekt"
    : commonDate != null && freeRoom.balanceDate !== commonDate
      ? `Peildatum vrije ruimte (${freeRoom.balanceDate}) wijkt af van rekeningpeildatum (${commonDate})`
      : null;
  let remainingFreeRoom = freeRoom == null
    ? null
    : round2(Math.max(0, freeRoom.originalCrediting - freeRoom.alreadyWithdrawn));
  const openingFreeRoom = remainingFreeRoom;
  let freeRoomExhaustedOn: string | null = remainingFreeRoom === 0 && commonDate ? commonDate : null;

  const fromYear = commonDate ? Number(commonDate.slice(0, 4)) : new Date().getFullYear();
  const vatOverrides = await getVatOverrides(entity.id, fromYear, toYear);
  const streamById = new Map(streams.map((s) => [s.id, s]));
  const linkedTaxes = new Map<number, Stream[]>();
  for (const s of streams.filter((x) => x.sourceStreamId != null && x.calculation === "percentage_van_bron")) {
    if (!linkedTaxes.has(s.sourceStreamId!)) linkedTaxes.set(s.sourceStreamId!, []);
    linkedTaxes.get(s.sourceStreamId!)!.push(s);
  }

  const monthDetails = new Map<string, {
    lines: CashLine[];
    missing: string[];
    vatMissing: string[];
    income: number;
    expenses: number;
    outputVat: number;
    inputVat: number;
  }>();

  const ensureMonth = (year: number, month: number) => {
    const key = monthKey(year, month);
    if (!monthDetails.has(key)) {
      monthDetails.set(key, { lines: [], missing: [], vatMissing: [], income: 0, expenses: 0, outputVat: 0, inputVat: 0 });
    }
    return monthDetails.get(key)!;
  };

  for (let year = fromYear; year <= toYear; year++) {
    for (let month = 1; month <= 12; month++) {
      const key = monthKey(year, month);
      const d = ensureMonth(year, month);
      const date = monthStart(year, month);

      for (const stream of streams) {
        if (stream.calculation === "percentage_van_bron") continue;
        if (stream.behavior === "planbaar") continue;
        if (!isDefaultOccurrence(stream, year, month)) continue;

        const rate = rateForDate(rates, stream.id, date);
        if (!rate || rate.amount == null) {
          const missingLabel = `tarief: ${stream.name}`;
          d.missing.push(missingLabel);
          if (!isExplicitlyVatFreeStream(stream)) d.vatMissing.push(missingLabel);
          d.lines.push({ streamId: stream.id, name: stream.name, category: stream.category, direction: stream.toEntityId === entity.id ? "in" : "uit", amount: null, vatPart: 0, source: "tarief_ontbreekt" });
          continue;
        }
        const cash = toCashAmount(rate.amount, rate.vatPct, rate.isInclVat);
        const vat = vatPart(cash, rate.vatPct, rate.isInclVat, rate.amount);
        const incoming = stream.toEntityId === entity.id;
        if (incoming) {
          d.income = round2(d.income + cash);
          d.outputVat = round2(d.outputVat + vat);
        } else {
          d.expenses = round2(d.expenses + cash);
          d.inputVat = round2(d.inputVat + vat * (rate.deductiblePct / 100));
        }
        d.lines.push({ streamId: stream.id, name: stream.name, category: stream.category, direction: incoming ? "in" : "uit", amount: cash, vatPart: vat, source: "tarief" });
      }

      for (const event of planEvents.get(key) ?? []) {
        const stream = streamById.get(event.streamId);
        if (!stream || !streamActiveOn(stream, event.originalDate)) continue;
        const rate = rateForDate(rates, stream.id, event.originalDate);
        const grossBase = event.amountOverride ?? rate?.amount ?? null;
        if (grossBase == null) {
          const missingLabel = `tarief: ${stream.name}`;
          d.missing.push(missingLabel);
          if (!isExplicitlyVatFreeStream(stream)) d.vatMissing.push(missingLabel);
          d.lines.push({ streamId: stream.id, name: stream.name, category: stream.category, direction: "uit", amount: null, vatPart: 0, source: event.status });
          continue;
        }

        const grossCash = rate
          ? toCashAmount(grossBase, rate.vatPct, rate.isInclVat)
          : round2(grossBase);

        if (stream.fiscalTreatment === "dividend_bruto") {
          const taxes = linkedTaxes.get(stream.id) ?? [];
          if (taxes.length !== 1) {
            d.missing.push(`gekoppelde dividendbelasting: ${stream.name}`);
            d.lines.push({ streamId: stream.id, name: stream.name, category: stream.category, direction: "uit", amount: null, vatPart: 0, source: event.status });
            continue;
          }
          const taxStream = taxes[0];
          const taxRate = rateForDate(rates, taxStream.id, event.actualDate);
          if (!taxRate || taxRate.sourcePercentage == null) {
            d.missing.push(`tarief: ${taxStream.name}`);
            d.lines.push({ streamId: stream.id, name: stream.name, category: stream.category, direction: "uit", amount: null, vatPart: 0, source: event.status });
            continue;
          }
          const taxAmount = round2(grossCash * taxRate.sourcePercentage / 100);
          const netDividend = round2(grossCash - taxAmount);
          d.expenses = round2(d.expenses + netDividend + taxAmount);
          d.lines.push({ streamId: stream.id, name: `${stream.name} (netto privé)`, category: stream.category, direction: "uit", amount: netDividend, vatPart: 0, source: event.status });
          d.lines.push({ streamId: taxStream.id, name: taxStream.name, category: taxStream.category, direction: "uit", amount: taxAmount, vatPart: 0, source: `gekoppeld aan ${stream.name}` });
          continue;
        }

        const vat = rate ? vatPart(grossCash, rate.vatPct, rate.isInclVat, grossBase) : 0;
        const incoming = stream.toEntityId === entity.id;
        if (incoming) {
          d.income = round2(d.income + grossCash);
          d.outputVat = round2(d.outputVat + vat);
        } else {
          d.expenses = round2(d.expenses + grossCash);
          d.inputVat = round2(d.inputVat + vat * ((rate?.deductiblePct ?? 0) / 100));
        }
        d.lines.push({ streamId: stream.id, name: stream.name, category: stream.category, direction: incoming ? "in" : "uit", amount: grossCash, vatPart: vat, source: event.status });
      }
      for (const event of privateWithdrawalEvents.get(key) ?? []) {
        const withdrawalStream = streamById.get(event.streamId);
        if (!withdrawalStream || !streamActiveOn(withdrawalStream, event.originalDate)) continue;

        const withdrawalRate = rateForDate(rates, withdrawalStream.id, event.originalDate);
        const desiredNet = event.amountOverride ?? withdrawalRate?.amount ?? null;
        if (desiredNet == null) {
          d.missing.push(`tarief: ${withdrawalStream.name}`);
          d.lines.push({
            streamId: withdrawalStream.id,
            name: withdrawalStream.name,
            category: withdrawalStream.category,
            direction: "uit",
            amount: null,
            vatPart: 0,
            source: event.status,
          });
          continue;
        }

        if (freeRoomProblem || remainingFreeRoom == null) {
          d.missing.push(freeRoomProblem ?? "Vrije-ruimteconfiguratie ontbreekt");
          d.lines.push({
            streamId: withdrawalStream.id,
            name: `${withdrawalStream.name} (vrije ruimte)`,
            category: withdrawalStream.category,
            direction: "uit",
            amount: null,
            vatPart: 0,
            source: event.status,
          });
          continue;
        }

        const freePart = round2(Math.min(remainingFreeRoom, desiredNet));
        const dividendNetTarget = round2(Math.max(0, desiredNet - freePart));

        if (freePart > 0) {
          d.expenses = round2(d.expenses + freePart);
          remainingFreeRoom = round2(remainingFreeRoom - freePart);
          d.lines.push({
            streamId: withdrawalStream.id,
            name: `${withdrawalStream.name} (rekening-courant/vrije ruimte)`,
            category: withdrawalStream.category,
            direction: "uit",
            amount: freePart,
            vatPart: 0,
            source: event.status,
          });
          if (remainingFreeRoom === 0 && freeRoomExhaustedOn == null) {
            freeRoomExhaustedOn = event.actualDate;
          }
        }

        if (dividendNetTarget <= 0) continue;

        const dividendStreams = streams.filter((x) =>
          x.fromEntityId === entity.id
          && x.category === "dividend"
          && x.fiscalTreatment === "dividend_bruto"
        );
        if (dividendStreams.length !== 1) {
          d.missing.push("Dividendstroom ontbreekt of is niet eenduidig");
          d.lines.push({
            streamId: 0,
            name: "Dividend voor resterende privé-opname",
            category: "dividend",
            direction: "uit",
            amount: null,
            vatPart: 0,
            source: event.status,
            netAfterBox2: dividendNetTarget,
          });
          continue;
        }

        const dividendStream = dividendStreams[0];
        const box2Rate = box2RateForDate(box2Rates, event.actualDate);
        if (!box2Rate) {
          d.missing.push(`Box 2-tarief: ${entity.name}`);
        }

        const taxes = linkedTaxes.get(dividendStream.id) ?? [];
        const taxStream = taxes.length === 1 ? taxes[0] : null;
        if (!taxStream) {
          d.missing.push(`gekoppelde dividendbelasting: ${dividendStream.name}`);
        }
        const taxRate = taxStream ? rateForDate(rates, taxStream.id, event.actualDate) : null;
        if (taxStream && (!taxRate || taxRate.sourcePercentage == null)) {
          d.missing.push(`tarief: ${taxStream.name}`);
        }

        if (!box2Rate || !taxStream || !taxRate || taxRate.sourcePercentage == null) {
          d.lines.push({
            streamId: dividendStream.id,
            name: `${dividendStream.name} (bruto te berekenen)`,
            category: dividendStream.category,
            direction: "uit",
            amount: null,
            vatPart: 0,
            source: event.status,
            netAfterBox2: dividendNetTarget,
            box2Percentage: box2Rate?.effectivePct,
          });
          continue;
        }

        const grossDividend = round2(dividendNetTarget / (1 - box2Rate.effectivePct / 100));
        const withholding = round2(grossDividend * taxRate.sourcePercentage / 100);
        const cashToPrivate = round2(grossDividend - withholding);

        d.expenses = round2(d.expenses + grossDividend);
        d.lines.push({
          streamId: dividendStream.id,
          name: `${dividendStream.name} (cash naar privé na inhouding)`,
          category: dividendStream.category,
          direction: "uit",
          amount: cashToPrivate,
          vatPart: 0,
          source: event.status,
          netAfterBox2: dividendNetTarget,
          box2Percentage: box2Rate.effectivePct,
        });
        d.lines.push({
          streamId: taxStream.id,
          name: taxStream.name,
          category: taxStream.category,
          direction: "uit",
          amount: withholding,
          vatPart: 0,
          source: `gekoppeld aan ${dividendStream.name}`,
        });
      }
    }
  }

  const vatQuarters: Array<{
    year: number;
    quarter: number;
    outputVat: number;
    inputVat: number;
    modelAmount: number | null;
    usedAmount: number | null;
    source: string;
    payDate: string;
    complete: boolean;
  }> = [];

  for (let year = fromYear; year <= toYear; year++) {
    for (let quarter = 1; quarter <= 4; quarter++) {
      const months = [quarter * 3 - 2, quarter * 3 - 1, quarter * 3];
      const ds = months.map((m) => ensureMonth(year, m));
      const complete = ds.every((x) => x.vatMissing.length === 0);
      const outputVat = round2(ds.reduce((s, x) => s + x.outputVat, 0));
      const inputVat = round2(ds.reduce((s, x) => s + x.inputVat, 0));
      const modelAmount = complete ? round2(outputVat - inputVat) : null;
      const override = vatOverrides.get(`${year}-${quarter}`);
      const usedAmount = override?.amount ?? modelAmount;
      const payDate = override?.payDate || vatPaymentDate(year, quarter);
      vatQuarters.push({
        year,
        quarter,
        outputVat,
        inputVat,
        modelAmount,
        usedAmount,
        source: override?.source ?? "model",
        payDate,
        complete: usedAmount != null,
      });
      if (usedAmount != null) {
        const py = Number(payDate.slice(0, 4));
        const pm = Number(payDate.slice(5, 7));
        if (py >= fromYear && py <= toYear) {
          const md = ensureMonth(py, pm);
          md.expenses = round2(md.expenses + Math.max(usedAmount, 0));
          md.income = round2(md.income + Math.max(-usedAmount, 0));
          md.lines.push({ streamId: 0, name: `BTW Q${quarter} ${year}`, category: "btw", direction: usedAmount >= 0 ? "uit" : "in", amount: Math.abs(usedAmount), vatPart: 0, source: override?.source ?? "model" });
        }
      } else {
        const defaultPayDate = vatPaymentDate(year, quarter);
        const py = Number(defaultPayDate.slice(0, 4));
        const pm = Number(defaultPayDate.slice(5, 7));
        if (py >= fromYear && py <= toYear) {
          ensureMonth(py, pm).missing.push(`BTW Q${quarter} ${year}`);
        }
      }
    }
  }

  const monthsOutput: Array<{
    year: number;
    month: number;
    income: number;
    expenses: number;
    cashChange: number | null;
    beginningBalance: number | null;
    endingBalance: number | null;
    minimumBuffer: number | null;
    belowMinimum: boolean | null;
    missingConfiguration: string[];
    lines: CashLine[];
  }> = [];

  let running = accountProblem == null ? startBalance : null;
  const startMonthIndex = commonDate
    ? Number(commonDate.slice(0, 4)) * 12 + Number(commonDate.slice(5, 7))
    : null;
  let lowestBalance: number | null = null;
  let lowestYear: number | null = null;
  let lowestMonth: number | null = null;

  for (let year = fromYear; year <= toYear; year++) {
    for (let month = 1; month <= 12; month++) {
      const idx = year * 12 + month;
      if (startMonthIndex != null && idx <= startMonthIndex) continue;
      const d = ensureMonth(year, month);
      const missing = [...new Set(d.missing)];
      const cashChange = missing.length ? null : round2(d.income - d.expenses);
      const beginningBalance = running;
      const endingBalance = running != null && cashChange != null ? round2(running + cashChange) : null;
      const belowMinimum = endingBalance == null || entity.minimumBuffer == null ? null : endingBalance < entity.minimumBuffer;
      monthsOutput.push({
        year,
        month,
        income: d.income,
        expenses: d.expenses,
        cashChange,
        beginningBalance,
        endingBalance,
        minimumBuffer: entity.minimumBuffer,
        belowMinimum,
        missingConfiguration: missing,
        lines: d.lines,
      });
      running = endingBalance;
      if (endingBalance != null && (lowestBalance == null || endingBalance < lowestBalance)) {
        lowestBalance = endingBalance;
        lowestYear = year;
        lowestMonth = month;
      }
    }
  }

  const allMissing = [...new Set(monthsOutput.flatMap((m) => m.missingConfiguration))];
  const complete = accountProblem == null && freeRoomProblem == null && allMissing.length === 0 && monthsOutput.every((m) => m.cashChange != null);

  return {
    entity: entity.name,
    available: complete,
    reason: accountProblem ?? freeRoomProblem ?? (allMissing.length ? "Een of meer maanden missen verplichte configuratie" : null),
    startDate: commonDate,
    startBalance,
    minimumBuffer: entity.minimumBuffer,
    accounts,
    freeRoom: freeRoom == null ? null : {
      balanceDate: freeRoom.balanceDate,
      originalCrediting: freeRoom.originalCrediting,
      alreadyWithdrawn: freeRoom.alreadyWithdrawn,
      openingRemaining: openingFreeRoom,
      remainingAfterForecast: remainingFreeRoom,
      exhaustedOn: freeRoomExhaustedOn,
    },
    missingConfiguration: allMissing,
    warnings: [
      "De halfjaarlijkse privé-opname gebruikt eerst de resterende rekening-courant/vrije ruimte. Een opname kan automatisch worden gesplitst in een onbelaste terugbetaling en dividend.",
      "Zodra dividend nodig is, wordt het bruto dividend berekend vanuit het gewenste netto bedrag na Box 2. Het effectieve Box-2-percentage en het inhoudingspercentage dividendbelasting moeten expliciet zijn geconfigureerd; ze worden niet hardcoded.",
      "Dividendbelasting is een voorheffing. Een eventuele aanvullende privé-Box-2-afrekening valt buiten de kasstroom van de holding, maar het veld netAfterBox2 bewaakt het gewenste netto privébedrag.",
      "Holding-BTW wordt alleen geblokkeerd door ontbrekende tarieven van BTW-relevante stromen; expliciet BTW-vrije stromen zoals DGA-loon, loonheffing, vrije ruimte en dividend blokkeren de BTW-berekening niet.",
    ],
    vatQuarters,
    months: monthsOutput,
    lowestBalance: complete ? lowestBalance : null,
    lowestYear: complete ? lowestYear : null,
    lowestMonth: complete ? lowestMonth : null,
    endingBalance: complete ? running : null,
  };
}

export async function berekenHoldingsMeerjaren(toYear: number) {
  const currentYear = new Date().getFullYear();
  if (!Number.isInteger(toYear) || toYear < currentYear || toYear > currentYear + 10) {
    throw new Error(`totJaar moet tussen ${currentYear} en ${currentYear + 10} liggen`);
  }

  const [rekka, eetjePans] = await Promise.all([
    calculateHolding("Rekka Holding B.V.", toYear),
    calculateHolding("Eetje Pans Holding B.V.", toYear),
  ]);

  return {
    toYear,
    available: rekka.available && eetjePans.available,
    holdings: [rekka, eetjePans],
  };
}
