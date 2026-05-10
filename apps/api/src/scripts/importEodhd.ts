import "../load-env";
import process from "node:process";
import { prisma } from "../db";
import { upsertFundamental } from "../db/queries";

type EodhdQuoteRow = {
  date: string;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
  volume: number | string;
};

type EodhdFundamentalsResponse = {
  General?: Record<string, unknown>;
  Valuation?: Record<string, unknown>;
  Highlights?: Record<string, unknown>;
};

function isErrorPayload(value: unknown): value is { error?: string } {
  return Boolean(value) && typeof value === "object" && "error" in (value as Record<string, unknown>);
}

type CompanyPick = {
  symbol: string;
  name: string;
};

const SOURCE = "EODHD";
const REQUEST_DELAY_MS = 200;
const IMPORT_DAYS = 365;
const EODHD_BASE = "https://eodhd.com/api";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getApiToken(): string {
  const token = process.env.EODHD_API_KEY?.trim();
  if (!token) {
    throw new Error("EODHD_API_KEY is not set. Add it to apps/api/.env before running import:eodhd.");
  }
  return token;
}

function toNum(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const parsed = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function buildFromDate(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function buildToDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function toExchangeTicker(symbol: string): string {
  return `${symbol.trim().toUpperCase()}.WAR`;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}: ${text.slice(0, 280)}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON from ${url}: ${text.slice(0, 280)}`);
  }
}

async function loadGpwCompanies(): Promise<CompanyPick[]> {
  try {
    const fromMarketColumn = await prisma.$queryRawUnsafe<CompanyPick[]>(
      "SELECT symbol, name FROM companies WHERE market = 'GPW' ORDER BY symbol ASC",
    );
    if (fromMarketColumn.length > 0) return fromMarketColumn;
  } catch {
    // Fallback for current schema where `companies.market` does not exist.
  }

  return prisma.company.findMany({
    where: {
      description: {
        contains: "Market=GPW",
        mode: "insensitive",
      },
    },
    select: { symbol: true, name: true },
    orderBy: { symbol: "asc" },
  });
}

async function importQuotesForSymbol(symbol: string, token: string, from: string, to: string): Promise<number> {
  const eodTicker = toExchangeTicker(symbol);
  const params = new URLSearchParams({
    from,
    to,
    api_token: token,
    fmt: "json",
  });
  const url = `${EODHD_BASE}/eod/${encodeURIComponent(eodTicker)}?${params.toString()}`;
  const rows = await fetchJson<EodhdQuoteRow[] | { error?: string }>(url);

  if (!Array.isArray(rows)) {
    if (rows && typeof rows === "object" && typeof rows.error === "string") {
      throw new Error(`EODHD quotes error for ${symbol}: ${rows.error}`);
    }
    throw new Error(`EODHD quotes returned unexpected payload for ${symbol}`);
  }

  let upserted = 0;
  for (const row of rows) {
    const open = toNum(row.open);
    const high = toNum(row.high);
    const low = toNum(row.low);
    const close = toNum(row.close);
    const volume = toNum(row.volume);
    if (open === null || high === null || low === null || close === null || volume === null) continue;

    const ts = new Date(`${row.date}T00:00:00.000Z`);
    if (Number.isNaN(ts.valueOf())) continue;

    await prisma.quote.upsert({
      where: {
        symbol_timestamp_source: {
          symbol: symbol.toUpperCase(),
          timestamp: ts,
          source: SOURCE,
        },
      },
      create: {
        symbol: symbol.toUpperCase(),
        timestamp: ts,
        open,
        high,
        low,
        close,
        volume: BigInt(Math.max(0, Math.trunc(volume))),
        source: SOURCE,
      },
      update: {
        open,
        high,
        low,
        close,
        volume: BigInt(Math.max(0, Math.trunc(volume))),
      },
    });
    upserted += 1;
  }
  return upserted;
}

async function importFundamentalsForSymbol(symbol: string, token: string): Promise<void> {
  const eodTicker = toExchangeTicker(symbol);
  const params = new URLSearchParams({
    api_token: token,
    fmt: "json",
  });
  const url = `${EODHD_BASE}/fundamentals/${encodeURIComponent(eodTicker)}?${params.toString()}`;
  const payload = await fetchJson<EodhdFundamentalsResponse | { error?: string }>(url);

  if (isErrorPayload(payload) && typeof payload.error === "string") {
    throw new Error(`EODHD fundamentals error for ${symbol}: ${payload.error}`);
  }

  const parsed = payload as EodhdFundamentalsResponse;
  const general = parsed.General ?? {};
  const valuation = parsed.Valuation ?? {};
  const highlights = parsed.Highlights ?? {};

  const name = typeof general.Name === "string" && general.Name.trim() ? general.Name.trim() : null;
  const sector = typeof general.Sector === "string" && general.Sector.trim() ? general.Sector.trim() : null;
  const industry = typeof general.Industry === "string" && general.Industry.trim() ? general.Industry.trim() : null;
  const currency =
    (typeof general.CurrencyCode === "string" && general.CurrencyCode.trim()) ||
    (typeof highlights.CurrencySymbol === "string" && highlights.CurrencySymbol.trim()) ||
    null;

  const marketCap = toNum(highlights.MarketCapitalization);
  const pe = toNum(valuation.TrailingPE) ?? toNum(highlights.PERatio);
  const pb = toNum(valuation.PriceBookMRQ);
  const ps = toNum(valuation.PriceSalesTTM);
  const evEbitda = toNum(valuation.EnterpriseValueEbitda);
  const eps = toNum(highlights.EarningsShare);
  const epsEstimate = toNum(highlights.EPSEstimateCurrentYear);
  const revenueGrowth = toNum(highlights.QuarterlyRevenueGrowthYOY);
  const dividendYield = toNum(highlights.DividendYield);

  const descriptionParts: string[] = [];
  if (marketCap !== null) descriptionParts.push(`MarketCap=${marketCap}`);
  if (currency) descriptionParts.push(`Currency=${currency}`);
  const fundamentalsSummary = descriptionParts.join("; ");

  await prisma.company.update({
    where: { symbol: symbol.toUpperCase() },
    data: {
      ...(name ? { name } : {}),
      ...(sector ? { sector } : {}),
      ...(industry ? { industry } : {}),
      ...(fundamentalsSummary
        ? {
            description: {
              set: fundamentalsSummary,
            },
          }
        : {}),
    },
  });

  if (marketCap !== null) await upsertFundamental(symbol, "market_cap", marketCap, 0);
  if (pe !== null) await upsertFundamental(symbol, "pe", pe, 0);
  if (pb !== null) await upsertFundamental(symbol, "pb", pb, 0);
  if (ps !== null) await upsertFundamental(symbol, "ps", ps, 0);
  if (evEbitda !== null) await upsertFundamental(symbol, "ev_ebitda", evEbitda, 0);
  if (eps !== null) await upsertFundamental(symbol, "eps", eps, 0);
  if (epsEstimate !== null) await upsertFundamental(symbol, "eps_estimate", epsEstimate, 0);
  if (revenueGrowth !== null) await upsertFundamental(symbol, "revenue_growth", revenueGrowth, 0);
  if (dividendYield !== null) await upsertFundamental(symbol, "dividend_yield", dividendYield, 0);
}

async function main(): Promise<void> {
  const token = getApiToken();
  const from = buildFromDate(IMPORT_DAYS);
  const to = buildToDate();
  const companies = await loadGpwCompanies();

  if (companies.length === 0) {
    console.log("[import:eodhd] no GPW companies found (market='GPW' or description contains 'Market=GPW').");
    return;
  }

  console.log(`[import:eodhd] companies=${companies.length} from=${from} to=${to}`);

  let done = 0;
  let failed = 0;
  for (const company of companies) {
    const sym = company.symbol.toUpperCase();
    try {
      process.stdout.write(`Importing ${sym}... `);
      const quotesCount = await importQuotesForSymbol(sym, token, from, to);
      await sleep(REQUEST_DELAY_MS);
      await importFundamentalsForSymbol(sym, token);
      await sleep(REQUEST_DELAY_MS);
      done += 1;
      console.log(`quotes: ${quotesCount}, done`);
    } catch (error) {
      failed += 1;
      const msg = error instanceof Error ? error.message : String(error);
      console.log(`failed: ${msg}`);
    }
  }

  console.log(`[import:eodhd] completed done=${done} failed=${failed} total=${companies.length}`);
}

main()
  .catch((error) => {
    console.error("[import:eodhd] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
