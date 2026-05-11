import type { PaperTrade, PaperTradeDirection, PrismaClient } from "@prisma/client";

type TaxSystemConfig = {
  name: string;
  currency: string;
  cgt: { rate: number | null; name: string; note?: string };
  form: string;
  note?: string;
};

export const TAX_SYSTEMS: Record<string, TaxSystemConfig> = {
  PL: {
    name: "Polska",
    currency: "PLN",
    cgt: { rate: 0.19, name: "Podatek Belki (PIT-38)" },
    form: "PIT-38",
  },
  DE: {
    name: "Deutschland",
    currency: "EUR",
    cgt: { rate: 0.26375, name: "Abgeltungssteuer" },
    form: "Anlage KAP",
  },
  FR: {
    name: "France",
    currency: "EUR",
    cgt: { rate: 0.3, name: "Prelevement Forfaitaire Unique (PFU)" },
    form: "2042 C",
  },
  ES: {
    name: "Espana",
    currency: "EUR",
    cgt: { rate: 0.19, name: "Impuesto sobre las Ganancias" },
    form: "Modelo 100",
  },
  GB: {
    name: "United Kingdom",
    currency: "GBP",
    cgt: { rate: 0.2, name: "Capital Gains Tax" },
    form: "Self Assessment",
  },
  US: {
    name: "United States",
    currency: "USD",
    cgt: { rate: 0.15, name: "Long-Term Capital Gains Tax" },
    note: "Rate depends on income bracket (0%/15%/20%)",
    form: "Schedule D",
  },
  JP: {
    name: "日本",
    currency: "JPY",
    cgt: { rate: 0.20315, name: "株式譲渡所得税" },
    form: "確定申告",
  },
  KR: {
    name: "대한민국",
    currency: "KRW",
    cgt: { rate: 0.22, name: "양도소득세" },
    form: "종합소득세",
  },
  TW: {
    name: "台灣",
    currency: "TWD",
    cgt: { rate: 0, name: "無資本利得稅", note: "No CGT on listed stocks" },
    form: "-",
  },
  IN: {
    name: "India",
    currency: "INR",
    cgt: { rate: 0.1, name: "Long-Term Capital Gains Tax" },
    note: "LTCG >₹1L: 10%, STCG: 15%",
    form: "ITR-2",
  },
  CUSTOM: {
    name: "Custom",
    currency: "USD",
    cgt: { rate: null, name: "Custom Rate" },
    form: "-",
  },
};

export type TaxTradeRow = {
  ticker: string;
  openDate: string;
  closeDate: string;
  pnl: number;
  pnlPct: number;
};

export type TaxSystemDto = TaxSystemConfig & { code: string };

export type TaxCalculationInput = {
  userId: string;
  country: string;
  trades?: TaxTradeRow[];
  customRate?: number;
  year?: number;
};

export type TaxCalculationResult = {
  country: string;
  countryName: string;
  currency: string;
  grossGains: number;
  losses: number;
  netIncome: number;
  taxRate: number;
  taxDue: number;
  taxName: string;
  form: string;
  note?: string;
  trades: TaxTradeRow[];
};

function toNum(v: unknown, fallback: number): number {
  if (v == null) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function computeClosedPnl(trade: PaperTrade): { pnl: number; pnlPct: number } {
  const stored = trade.pnl != null ? Number(trade.pnl) : Number.NaN;
  if (Number.isFinite(stored)) {
    const pct = trade.pnlPct != null ? Number(trade.pnlPct) : 0;
    return { pnl: stored, pnlPct: Number.isFinite(pct) ? pct : 0 };
  }
  const qty = toNum(trade.quantity, 0);
  const entry = toNum(trade.entryPrice, 0);
  const exit = trade.exitPrice != null ? toNum(trade.exitPrice, 0) : 0;
  if (qty <= 0 || entry <= 0 || exit <= 0) return { pnl: 0, pnlPct: 0 };
  const dir = trade.direction as PaperTradeDirection;
  const pnl =
    dir === "LONG" ? (exit - entry) * qty : dir === "SHORT" ? (entry - exit) * qty : 0;
  const denom = entry * qty;
  const pnlPct = denom > 0 ? (pnl / denom) * 100 : 0;
  return { pnl, pnlPct };
}

function yearBounds(year: number): { start: Date; end: Date } {
  const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));
  return { start, end };
}

async function loadClosedTrades(
  prisma: PrismaClient,
  userId: string,
  year?: number,
): Promise<TaxTradeRow[]> {
  const where =
    year == null
      ? { userId, status: "CLOSED" as const }
      : (() => {
          const { start, end } = yearBounds(year);
          return {
            userId,
            status: "CLOSED" as const,
            exitAt: { gte: start, lt: end },
          };
        })();

  const rows = await prisma.paperTrade.findMany({
    where,
    orderBy: { exitAt: "desc" },
  });

  return rows.map((row) => {
    const { pnl, pnlPct } = computeClosedPnl(row);
    const exitAt = row.exitAt ?? row.entryAt;
    return {
      ticker: String(row.ticker).toUpperCase(),
      openDate: row.entryAt.toISOString(),
      closeDate: exitAt.toISOString(),
      pnl,
      pnlPct,
    };
  });
}

function getTaxRate(country: string, customRate?: number): number {
  const code = country.toUpperCase();
  if (code === "CUSTOM") {
    if (customRate == null || !Number.isFinite(customRate) || customRate < 0) {
      throw new Error("customRate is required for CUSTOM country");
    }
    return customRate > 1 ? customRate / 100 : customRate;
  }
  const system = TAX_SYSTEMS[code];
  if (!system) throw new Error(`Unsupported country: ${country}`);
  return system.cgt.rate ?? 0;
}

export function listTaxSystems(): TaxSystemDto[] {
  return Object.entries(TAX_SYSTEMS).map(([code, cfg]) => ({ code, ...cfg }));
}

export async function calculateTaxBySystem(
  prisma: PrismaClient,
  input: TaxCalculationInput,
): Promise<TaxCalculationResult> {
  const country = input.country.trim().toUpperCase();
  const system = TAX_SYSTEMS[country];
  if (!system) throw new Error(`Unsupported country: ${country}`);

  const trades =
    input.trades && input.trades.length > 0
      ? input.trades
      : await loadClosedTrades(prisma, input.userId, input.year);

  let grossGains = 0;
  let losses = 0;
  for (const trade of trades) {
    if (trade.pnl > 0) grossGains += trade.pnl;
    else if (trade.pnl < 0) losses += Math.abs(trade.pnl);
  }

  const netIncome = grossGains - losses;
  const taxBase = Math.max(0, netIncome);
  const taxRate = getTaxRate(country, input.customRate);
  const taxDue = taxBase * taxRate;

  const round = (n: number): number => Math.round(n * 100) / 100;

  return {
    country,
    countryName: system.name,
    currency: system.currency,
    grossGains: round(grossGains),
    losses: round(losses),
    netIncome: round(netIncome),
    taxRate,
    taxDue: round(taxDue),
    taxName: system.cgt.name,
    form: system.form,
    note: system.note ?? system.cgt.note,
    trades,
  };
}
