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

type WatchCompany = {
  symbol: string;
  name: string;
};

type ExchangeConfig = {
  exchange: string;
  suffix: string;
  companies: WatchCompany[];
};

const SOURCE = "EODHD";
const REQUEST_DELAY_MS = 200;
const IMPORT_DAYS = 365;
const EODHD_BASE = "https://eodhd.com/api";

const EXCHANGES: ExchangeConfig[] = [
  {
    exchange: "LSE",
    suffix: ".LSE",
    companies: [
      { symbol: "SHEL", name: "Shell plc" },
      { symbol: "AZN", name: "AstraZeneca PLC" },
      { symbol: "HSBA", name: "HSBC Holdings plc" },
      { symbol: "BP", name: "BP p.l.c." },
      { symbol: "ULVR", name: "Unilever PLC" },
    ],
  },
  {
    exchange: "PA",
    suffix: ".PA",
    companies: [
      { symbol: "TTE", name: "TotalEnergies SE" },
      { symbol: "SAN", name: "Sanofi SA" },
      { symbol: "AIR", name: "Airbus SE" },
      { symbol: "BNP", name: "BNP Paribas SA" },
      { symbol: "OR", name: "L'Oreal SA" },
    ],
  },
  {
    exchange: "AS",
    suffix: ".AS",
    companies: [
      { symbol: "ASML", name: "ASML Holding N.V." },
      { symbol: "PHIA", name: "Koninklijke Philips N.V." },
      { symbol: "INGA", name: "ING Groep N.V." },
      { symbol: "REN", name: "RELX PLC" },
      { symbol: "AD", name: "Koninklijke Ahold Delhaize N.V." },
    ],
  },
  {
    exchange: "XETRA",
    suffix: ".XETRA",
    companies: [
      { symbol: "SAP", name: "SAP SE" },
      { symbol: "SIE", name: "Siemens AG" },
      { symbol: "ALV", name: "Allianz SE" },
      { symbol: "BAS", name: "BASF SE" },
      { symbol: "MRK", name: "Merck KGaA" },
    ],
  },
  {
    exchange: "TSE",
    suffix: ".TSE",
    companies: [
      { symbol: "7203", name: "Toyota Motor Corp." },
      { symbol: "6758", name: "Sony Group Corp." },
      { symbol: "9984", name: "SoftBank Group Corp." },
      { symbol: "9432", name: "Nippon Telegraph & Telephone Corp." },
      { symbol: "7974", name: "Nintendo Co. Ltd." },
    ],
  },
  {
    exchange: "NSE",
    suffix: ".NSE",
    companies: [
      { symbol: "RELIANCE", name: "Reliance Industries Ltd." },
      { symbol: "TCS", name: "Tata Consultancy Services Ltd." },
      { symbol: "HDFCBANK", name: "HDFC Bank Ltd." },
      { symbol: "INFY", name: "Infosys Ltd." },
      { symbol: "ICICIBANK", name: "ICICI Bank Ltd." },
    ],
  },
  {
    exchange: "BSE",
    suffix: ".BSE",
    companies: [
      { symbol: "RELIANCE", name: "Reliance Industries Ltd." },
      { symbol: "TCS", name: "Tata Consultancy Services Ltd." },
      { symbol: "HDFCBANK", name: "HDFC Bank Ltd." },
      { symbol: "INFY", name: "Infosys Ltd." },
      { symbol: "ICICIBANK", name: "ICICI Bank Ltd." },
    ],
  },
  {
    exchange: "KO",
    suffix: ".KO",
    companies: [
      { symbol: "005930", name: "Samsung Electronics Co. Ltd." },
      { symbol: "000660", name: "SK hynix Inc." },
      { symbol: "051910", name: "LG Chem Ltd." },
      { symbol: "035420", name: "NAVER Corp." },
      { symbol: "005380", name: "Hyundai Motor Co." },
    ],
  },
  {
    exchange: "HK",
    suffix: ".HK",
    companies: [
      { symbol: "0700", name: "Tencent Holdings Ltd." },
      { symbol: "0939", name: "China Construction Bank Corp." },
      { symbol: "1299", name: "AIA Group Ltd." },
      { symbol: "0005", name: "HSBC Holdings plc (HK)" },
      { symbol: "0941", name: "China Mobile Ltd." },
    ],
  },
  {
    exchange: "AU",
    suffix: ".AU",
    companies: [
      { symbol: "CBA", name: "Commonwealth Bank of Australia" },
      { symbol: "BHP", name: "BHP Group Ltd." },
      { symbol: "CSL", name: "CSL Limited" },
      { symbol: "NAB", name: "National Australia Bank Ltd." },
      { symbol: "WBC", name: "Westpac Banking Corp." },
    ],
  },
  {
    exchange: "TO",
    suffix: ".TO",
    companies: [
      { symbol: "RY", name: "Royal Bank of Canada" },
      { symbol: "TD", name: "The Toronto-Dominion Bank" },
      { symbol: "BNS", name: "The Bank of Nova Scotia" },
      { symbol: "CNR", name: "Canadian National Railway Co." },
      { symbol: "SU", name: "Suncor Energy Inc." },
    ],
  },
  {
    exchange: "SW",
    suffix: ".SW",
    companies: [
      { symbol: "NESN", name: "Nestle SA" },
      { symbol: "ROG", name: "Roche Holding AG" },
      { symbol: "NOVN", name: "Novartis AG" },
      { symbol: "ABBN", name: "ABB Ltd." },
      { symbol: "ZURN", name: "Zurich Insurance Group AG" },
    ],
  },
];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getApiToken(): string {
  const token = process.env.EODHD_API_KEY?.trim();
  if (!token) {
    throw new Error("EODHD_API_KEY is not set. Add it to apps/api/.env before running import:eodhd:global.");
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

function toEodTicker(symbol: string, suffix: string): string {
  return `${symbol.trim().toUpperCase()}${suffix}`;
}

function isErrorPayload(value: unknown): value is { error?: string } {
  return Boolean(value) && typeof value === "object" && "error" in (value as Record<string, unknown>);
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

async function upsertCompanySkeleton(
  canonicalTicker: string,
  exchange: string,
  fallbackName: string,
): Promise<void> {
  const description = `Market=GLOBAL; Exchange=${exchange}`;
  await prisma.company.upsert({
    where: { symbol: canonicalTicker },
    create: {
      symbol: canonicalTicker,
      name: fallbackName,
      sector: "Unknown",
      industry: "Unknown",
      description,
    },
    update: {
      name: fallbackName,
      description,
    },
  });
  await prisma.$executeRawUnsafe(
    'UPDATE "companies" SET "exchange" = $1 WHERE "symbol" = $2',
    exchange,
    canonicalTicker,
  );
}

async function importQuotesForTicker(
  canonicalTicker: string,
  eodTicker: string,
  token: string,
  from: string,
  to: string,
): Promise<number> {
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
      throw new Error(`EODHD quotes error for ${eodTicker}: ${rows.error}`);
    }
    throw new Error(`EODHD quotes returned unexpected payload for ${eodTicker}`);
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
          symbol: canonicalTicker,
          timestamp: ts,
          source: SOURCE,
        },
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
    upserted += 1;
  }
  return upserted;
}

async function importFundamentalsForTicker(
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

  if (isErrorPayload(payload) && typeof payload.error === "string") {
    throw new Error(`EODHD fundamentals error for ${eodTicker}: ${payload.error}`);
  }

  const parsed = payload as EodhdFundamentalsResponse;
  const general = parsed.General ?? {};
  const valuation = parsed.Valuation ?? {};
  const highlights = parsed.Highlights ?? {};

  const name =
    typeof general.Name === "string" && general.Name.trim() ? general.Name.trim() : fallbackName;
  const sector = typeof general.Sector === "string" && general.Sector.trim() ? general.Sector.trim() : "Unknown";
  const industry =
    typeof general.Industry === "string" && general.Industry.trim() ? general.Industry.trim() : "Unknown";
  const currency =
    (typeof general.CurrencyCode === "string" && general.CurrencyCode.trim()) ||
    (typeof highlights.CurrencySymbol === "string" && highlights.CurrencySymbol.trim()) ||
    null;
  const country = typeof general.CountryName === "string" && general.CountryName.trim() ? general.CountryName.trim() : null;

  const marketCap = toNum(highlights.MarketCapitalization);
  const pe = toNum(valuation.TrailingPE) ?? toNum(highlights.PERatio);
  const pb = toNum(valuation.PriceBookMRQ);
  const ps = toNum(valuation.PriceSalesTTM);
  const evEbitda = toNum(valuation.EnterpriseValueEbitda);
  const eps = toNum(highlights.EarningsShare);
  const epsEstimate = toNum(highlights.EPSEstimateCurrentYear);
  const revenueGrowth = toNum(highlights.QuarterlyRevenueGrowthYOY);
  const dividendYield = toNum(highlights.DividendYield);

  const descriptionParts = [`Market=GLOBAL`, `Exchange=${exchange}`];
  if (country) descriptionParts.push(`Country=${country}`);
  if (currency) descriptionParts.push(`Currency=${currency}`);
  if (marketCap !== null) descriptionParts.push(`MarketCap=${marketCap}`);

  await prisma.company.update({
    where: { symbol: canonicalTicker },
    data: {
      name,
      sector,
      industry,
      description: descriptionParts.join("; "),
    },
  });
  await prisma.$executeRawUnsafe(
    'UPDATE "companies" SET "exchange" = $1 WHERE "symbol" = $2',
    exchange,
    canonicalTicker,
  );

  if (marketCap !== null) await upsertFundamental(canonicalTicker, "market_cap", marketCap, 0);
  if (pe !== null) await upsertFundamental(canonicalTicker, "pe", pe, 0);
  if (pb !== null) await upsertFundamental(canonicalTicker, "pb", pb, 0);
  if (ps !== null) await upsertFundamental(canonicalTicker, "ps", ps, 0);
  if (evEbitda !== null) await upsertFundamental(canonicalTicker, "ev_ebitda", evEbitda, 0);
  if (eps !== null) await upsertFundamental(canonicalTicker, "eps", eps, 0);
  if (epsEstimate !== null) await upsertFundamental(canonicalTicker, "eps_estimate", epsEstimate, 0);
  if (revenueGrowth !== null) await upsertFundamental(canonicalTicker, "revenue_growth", revenueGrowth, 0);
  if (dividendYield !== null) await upsertFundamental(canonicalTicker, "dividend_yield", dividendYield, 0);
}

async function main(): Promise<void> {
  const token = getApiToken();
  const from = buildFromDate(IMPORT_DAYS);
  const to = buildToDate();
  const total = EXCHANGES.reduce((acc, row) => acc + row.companies.length, 0);
  console.log(`[import:eodhd:global] exchanges=${EXCHANGES.length} symbols=${total} from=${from} to=${to}`);

  let done = 0;
  let failed = 0;
  for (const exchange of EXCHANGES) {
    console.log(`[import:eodhd:global] exchange=${exchange.exchange} symbols=${exchange.companies.length}`);
    for (const company of exchange.companies) {
      const eodTicker = toEodTicker(company.symbol, exchange.suffix);
      const canonicalTicker = eodTicker.toUpperCase();
      try {
        await upsertCompanySkeleton(canonicalTicker, exchange.exchange, company.name);
        process.stdout.write(`Importing ${eodTicker}... `);
        const quotesCount = await importQuotesForTicker(canonicalTicker, eodTicker, token, from, to);
        await sleep(REQUEST_DELAY_MS);
        await importFundamentalsForTicker(
          canonicalTicker,
          eodTicker,
          exchange.exchange,
          company.name,
          token,
        );
        await sleep(REQUEST_DELAY_MS);
        done += 1;
        console.log(`quotes: ${quotesCount}, done`);
      } catch (error) {
        failed += 1;
        const msg = error instanceof Error ? error.message : String(error);
        console.log(`failed: ${msg}`);
      }
    }
  }

  console.log(`[import:eodhd:global] completed done=${done} failed=${failed} total=${total}`);
}

main()
  .catch((error) => {
    console.error("[import:eodhd:global] failed", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
