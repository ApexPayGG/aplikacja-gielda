import process from "node:process";
import { prisma } from "../../db";
import { searchCompanies } from "../../db/company-queries";
import { upsertFundamental } from "../../db/queries";

type EodhdSearchRow = Record<string, unknown>;
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

export type CompanySearchResultItem = {
  symbol: string;
  name: string;
  exchange: string;
  sector: string;
  logoUrl: string | null;
};

const EODHD_BASE = "https://eodhd.com/api";
const SOURCE = "EODHD";
const IMPORT_DAYS = 365;
const REQUEST_DELAY_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getApiToken(): string {
  const token = process.env.EODHD_API_KEY?.trim();
  if (!token) {
    throw new Error("EODHD_API_KEY is not set");
  }
  return token;
}

function toNum(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function toStr(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v ? v : null;
}

function normalizeLogoUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  if (raw.startsWith("/")) return `https://eodhd.com${raw}`;
  return `https://eodhd.com/${raw.replace(/^\/+/, "")}`;
}

function buildFromDate(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

function buildToDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeExchange(exchangeInput: string): string {
  const clean = exchangeInput.trim().replace(/^\./, "").toUpperCase();
  if (!clean) throw new Error("Missing exchange");
  return clean;
}

function normalizeSymbol(symbolInput: string): string {
  const clean = symbolInput.trim().toUpperCase();
  if (!clean) throw new Error("Missing symbol");
  return clean;
}

function toEodTicker(symbolInput: string, exchangeInput: string): { canonical: string; eodTicker: string; exchange: string } {
  const symbol = normalizeSymbol(symbolInput);
  if (symbol.includes(".")) {
    const [base, ex] = symbol.split(".");
    const exchange = normalizeExchange(ex ?? exchangeInput);
    const canonical = `${base}.${exchange}`.toUpperCase();
    return { canonical, eodTicker: canonical, exchange };
  }
  const exchange = normalizeExchange(exchangeInput);
  const eodTicker = `${symbol}.${exchange}`.toUpperCase();
  return { canonical: eodTicker, eodTicker, exchange };
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 240)}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Invalid JSON payload: ${text.slice(0, 240)}`);
  }
}

export function mapDbRowsToSearch(rows: Awaited<ReturnType<typeof searchCompanies>>): CompanySearchResultItem[] {
  return rows.map((row) => ({
    symbol: row.symbol,
    name: row.name,
    exchange:
      (((row as unknown as { exchange?: string }).exchange ??
        row.description?.match(/Exchange=([A-Z0-9_]+)/i)?.[1]) ??
        "UNKNOWN"
      ).toUpperCase(),
    sector: row.sector || "Unknown",
    logoUrl: row.logoUrl ?? null,
  }));
}

export function mapEodSearchRow(row: EodhdSearchRow): CompanySearchResultItem | null {
  const code = toStr(row.Code ?? row.code ?? row.Symbol ?? row.symbol);
  const exchange = toStr(row.Exchange ?? row.exchange);
  if (!code || !exchange) return null;
  const symbol = `${code.toUpperCase()}.${exchange.toUpperCase()}`;
  const logoUrl = normalizeLogoUrl(
    row.LogoURL ?? row.LogoUrl ?? row.logoUrl ?? row.Logo ?? row.logo ?? row.Image ?? row.image,
  );
  return {
    symbol,
    name: toStr(row.Name ?? row.name) ?? code.toUpperCase(),
    exchange: exchange.toUpperCase(),
    sector: "Unknown",
    logoUrl,
  };
}

export type CompanySearchDependencies = {
  searchDb: (query: string, limit: number) => Promise<CompanySearchResultItem[]>;
  searchEod: (query: string, limit: number) => Promise<CompanySearchResultItem[]>;
};

function normalizeSearchLimit(limit: number): number {
  return Math.min(50, Math.max(1, Number.isFinite(limit) ? Math.trunc(limit) : 8));
}

function dedupeBySymbol(items: CompanySearchResultItem[]): CompanySearchResultItem[] {
  const seen = new Set<string>();
  const out: CompanySearchResultItem[] = [];
  for (const row of items) {
    const key = row.symbol.trim().toUpperCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(row);
  }
  return out;
}

async function searchEodCompanies(query: string, limit: number): Promise<CompanySearchResultItem[]> {
  const token = getApiToken();
  const params = new URLSearchParams({
    api_token: token,
    limit: String(limit),
    fmt: "json",
  });
  const url = `${EODHD_BASE}/search/${encodeURIComponent(query)}?${params.toString()}`;
  const rows = await fetchJson<EodhdSearchRow[] | { error?: string }>(url);
  if (!Array.isArray(rows)) {
    throw new Error(typeof rows.error === "string" ? rows.error : "Unexpected search payload from EODHD");
  }
  return rows.map(mapEodSearchRow).filter((r): r is CompanySearchResultItem => r !== null);
}

const defaultSearchDependencies: CompanySearchDependencies = {
  searchDb: async (query, limit) => {
    const dbRows = await searchCompanies(query, limit);
    return mapDbRowsToSearch(dbRows);
  },
  searchEod: searchEodCompanies,
};

async function setCompanyExchange(symbol: string, exchange: string): Promise<void> {
  await prisma.$executeRawUnsafe(
    'UPDATE "companies" SET "exchange" = $1 WHERE "symbol" = $2',
    exchange,
    symbol.toUpperCase(),
  );
}

async function importQuotes(canonicalTicker: string, eodTicker: string, token: string): Promise<number> {
  const params = new URLSearchParams({
    from: buildFromDate(IMPORT_DAYS),
    to: buildToDate(),
    api_token: token,
    fmt: "json",
  });
  const url = `${EODHD_BASE}/eod/${encodeURIComponent(eodTicker)}?${params.toString()}`;
  const rows = await fetchJson<EodhdQuoteRow[] | { error?: string }>(url);
  if (!Array.isArray(rows)) {
    throw new Error(typeof rows.error === "string" ? rows.error : `Unexpected quotes payload for ${eodTicker}`);
  }

  let count = 0;
  for (const row of rows) {
    const open = toNum(row.open);
    const high = toNum(row.high);
    const low = toNum(row.low);
    const close = toNum(row.close);
    const volume = toNum(row.volume);
    if (open == null || high == null || low == null || close == null || volume == null) continue;
    const ts = new Date(`${row.date}T00:00:00.000Z`);
    if (Number.isNaN(ts.getTime())) continue;

    await prisma.quote.upsert({
      where: {
        symbol_timestamp_source: { symbol: canonicalTicker, timestamp: ts, source: SOURCE },
      },
      create: {
        symbol: canonicalTicker,
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
    count += 1;
  }
  return count;
}

async function importFundamentals(
  canonicalTicker: string,
  eodTicker: string,
  exchange: string,
  fallbackName: string,
  token: string,
): Promise<void> {
  const params = new URLSearchParams({
    api_token: token,
    fmt: "json",
  });
  const url = `${EODHD_BASE}/fundamentals/${encodeURIComponent(eodTicker)}?${params.toString()}`;
  const payload = await fetchJson<EodhdFundamentalsResponse | { error?: string }>(url);
  if ("error" in (payload as Record<string, unknown>) && typeof (payload as { error?: unknown }).error === "string") {
    throw new Error(String((payload as { error?: unknown }).error));
  }

  const parsed = payload as EodhdFundamentalsResponse;
  const general = parsed.General ?? {};
  const valuation = parsed.Valuation ?? {};
  const highlights = parsed.Highlights ?? {};

  const name = toStr(general.Name) ?? fallbackName;
  const sector = toStr(general.Sector) ?? "Unknown";
  const industry = toStr(general.Industry) ?? "Unknown";
  const currency = toStr(general.CurrencyCode ?? highlights.CurrencySymbol);
  const country = toStr(general.CountryName);
  const logoUrl = normalizeLogoUrl(general.LogoURL ?? general.Logo);
  const marketCap = toNum(highlights.MarketCapitalization);

  const descriptionParts = [`Market=GLOBAL`, `Exchange=${exchange}`];
  if (country) descriptionParts.push(`Country=${country}`);
  if (currency) descriptionParts.push(`Currency=${currency}`);
  if (marketCap != null) descriptionParts.push(`MarketCap=${marketCap}`);

  await prisma.company.update({
    where: { symbol: canonicalTicker },
    data: {
      name,
      sector,
      industry,
      description: descriptionParts.join("; "),
      ...(logoUrl ? { logoUrl } : {}),
    },
  });
  await setCompanyExchange(canonicalTicker, exchange);

  const pe = toNum(valuation.TrailingPE) ?? toNum(highlights.PERatio);
  const pb = toNum(valuation.PriceBookMRQ);
  const ps = toNum(valuation.PriceSalesTTM);
  const evEbitda = toNum(valuation.EnterpriseValueEbitda);
  const eps = toNum(highlights.EarningsShare);
  const epsEstimate = toNum(highlights.EPSEstimateCurrentYear);
  const revenueGrowth = toNum(highlights.QuarterlyRevenueGrowthYOY);
  const dividendYield = toNum(highlights.DividendYield);

  if (marketCap != null) await upsertFundamental(canonicalTicker, "market_cap", marketCap, 0);
  if (pe != null) await upsertFundamental(canonicalTicker, "pe", pe, 0);
  if (pb != null) await upsertFundamental(canonicalTicker, "pb", pb, 0);
  if (ps != null) await upsertFundamental(canonicalTicker, "ps", ps, 0);
  if (evEbitda != null) await upsertFundamental(canonicalTicker, "ev_ebitda", evEbitda, 0);
  if (eps != null) await upsertFundamental(canonicalTicker, "eps", eps, 0);
  if (epsEstimate != null) await upsertFundamental(canonicalTicker, "eps_estimate", epsEstimate, 0);
  if (revenueGrowth != null) await upsertFundamental(canonicalTicker, "revenue_growth", revenueGrowth, 0);
  if (dividendYield != null) await upsertFundamental(canonicalTicker, "dividend_yield", dividendYield, 0);
}

export async function importCompanyOnDemand(input: {
  symbol: string;
  exchange: string;
  name?: string;
}): Promise<{ imported: boolean; symbol: string; quotesCount: number }> {
  const token = getApiToken();
  const { canonical, eodTicker, exchange } = toEodTicker(input.symbol, input.exchange);
  const fallbackName = input.name?.trim() || canonical;

  await prisma.company.upsert({
    where: { symbol: canonical },
    create: {
      symbol: canonical,
      name: fallbackName,
      sector: "Unknown",
      industry: "Unknown",
      description: `Market=GLOBAL; Exchange=${exchange}`,
    },
    update: {
      name: fallbackName,
      description: `Market=GLOBAL; Exchange=${exchange}`,
    },
  });
  await setCompanyExchange(canonical, exchange);

  const quotesCount = await importQuotes(canonical, eodTicker, token);
  await sleep(REQUEST_DELAY_MS);
  await importFundamentals(canonical, eodTicker, exchange, fallbackName, token);
  await sleep(REQUEST_DELAY_MS);

  return { imported: true, symbol: canonical, quotesCount };
}

export async function searchCompaniesOnDemand(
  query: string,
  limit = 8,
  dependencies: CompanySearchDependencies = defaultSearchDependencies,
): Promise<CompanySearchResultItem[]> {
  const q = query.trim();
  if (!q) return [];
  const take = normalizeSearchLimit(limit);

  const dbRows = await dependencies.searchDb(q, take);
  const merged = dedupeBySymbol(dbRows).slice(0, take);

  if (merged.length < 3) {
    try {
      const eodRows = await dependencies.searchEod(q, take);
      const withFallback = dedupeBySymbol([...merged, ...eodRows]).slice(0, take);
      return withFallback;
    } catch (error) {
      console.warn("[companies.search] eod fallback failed", error);
    }
  }

  return merged;
}
