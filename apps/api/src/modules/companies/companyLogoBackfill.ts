import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../db";
import { fetchCompanyProfile } from "../../scrapers/finnhub-company.scraper";
import {
  areLikelySameCompanyName,
  normalizeLogoUrl,
  parseSymbolParts,
} from "./companySearchModule";

const EODHD_BASE = "https://eodhd.com/api";
const PREFERRED_EXCHANGES = ["US", "WAR", "XETRA", "LSE"] as const;
const EODHD_DELAY_MS = 200;

export type CompanyLogoRow = {
  symbol: string;
  name: string;
  exchange: string;
  logoUrl: string | null;
};

export type CompanyLogoBackfillSummary = {
  scanned: number;
  updated: number;
  skippedNoProviderLogo: number;
  skippedUnsafeMatch: number;
  copiedFromExistingVariant: number;
  fetchedFromEodhd: number;
  fetchedFromFinnhub: number;
  errors: number;
  dryRun: boolean;
};

export type CompanyLogoBackfillOptions = {
  limit?: number;
  dryRun?: boolean;
  force?: boolean;
  delayMs?: number;
};

export type CompanyLogoBackfillDeps = {
  db: {
    company: {
      findMany: PrismaClient["company"]["findMany"];
      update: PrismaClient["company"]["update"];
    };
  };
  fetchEodhdLogo: (symbol: string, exchange: string) => Promise<string | null>;
  fetchFinnhubLogo: (symbol: string) => Promise<string | null>;
  sleep: (ms: number) => Promise<void>;
};

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function exchangeForRow(row: CompanyLogoRow): string {
  const fromSymbol = parseSymbolParts(row.symbol).exchange;
  if (fromSymbol) return fromSymbol;
  const ex = row.exchange?.trim().toUpperCase();
  return ex && ex !== "UNKNOWN" ? ex : "US";
}

function buildEodTicker(symbol: string, exchange: string): string {
  const parts = parseSymbolParts(symbol);
  if (parts.exchange) return parts.full;
  const ex = exchange.trim().toUpperCase() || "US";
  return `${parts.base}.${ex}`;
}

function finnhubSymbol(symbol: string, exchange: string): string {
  const parts = parseSymbolParts(symbol);
  if (parts.exchange === "US" || exchange === "US") return parts.base;
  return parts.full.includes(".") ? parts.base : symbol;
}

export function indexCompaniesWithLogo(rows: CompanyLogoRow[]): Map<string, CompanyLogoRow[]> {
  const byBase = new Map<string, CompanyLogoRow[]>();
  for (const row of rows) {
    if (!row.logoUrl?.trim()) continue;
    const base = parseSymbolParts(row.symbol).base;
    const list = byBase.get(base) ?? [];
    list.push(row);
    byBase.set(base, list);
  }
  return byBase;
}

export function pickLogoDonorFromVariants(
  target: CompanyLogoRow,
  donorsByBase: Map<string, CompanyLogoRow[]>,
): { donor: CompanyLogoRow; reason: "variant" } | { skipped: "unsafe" } | null {
  const base = parseSymbolParts(target.symbol).base;
  const peers = donorsByBase.get(base) ?? [];
  const safe = peers.filter(
    (peer) => peer.logoUrl?.trim() && areLikelySameCompanyName(peer.name, target.name),
  );
  if (peers.length > 0 && safe.length === 0) {
    return { skipped: "unsafe" };
  }
  if (safe.length === 0) return null;

  const targetEx = exchangeForRow(target);
  const ranked = [...safe].sort((a, b) => {
    const score = (row: CompanyLogoRow) => {
      let s = 0;
      if (row.symbol === target.symbol) s += 1000;
      const ex = exchangeForRow(row);
      if (ex === targetEx) s += 100;
      const pref = PREFERRED_EXCHANGES.indexOf(ex as (typeof PREFERRED_EXCHANGES)[number]);
      if (pref >= 0) s += 10 - pref;
      return s;
    };
    return score(b) - score(a);
  });
  const donor = ranked[0];
  if (!donor?.logoUrl) return null;
  return { donor, reason: "variant" };
}

export async function fetchEodhdFundamentalsLogo(
  symbol: string,
  exchange: string,
  apiToken: string,
): Promise<string | null> {
  const eodTicker = buildEodTicker(symbol, exchange);
  const params = new URLSearchParams({ api_token: apiToken, fmt: "json" });
  const url = `${EODHD_BASE}/fundamentals/${encodeURIComponent(eodTicker)}?${params.toString()}`;
  const res = await fetch(url);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`EODHD fundamentals HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  const payload = JSON.parse(text) as { General?: Record<string, unknown>; error?: string };
  if (typeof payload.error === "string") {
    throw new Error(payload.error);
  }
  const general = payload.General ?? {};
  return normalizeLogoUrl(general.LogoURL ?? general.Logo);
}

function createDefaultDeps(): CompanyLogoBackfillDeps {
  const eodToken = process.env.EODHD_API_KEY?.trim();
  const finnhubEnabled = Boolean(process.env.FINNHUB_API_KEY?.trim());

  return {
    db: defaultPrisma,
    sleep: sleepMs,
    fetchEodhdLogo: async (symbol, exchange) => {
      if (!eodToken) return null;
      return fetchEodhdFundamentalsLogo(symbol, exchange, eodToken);
    },
    fetchFinnhubLogo: async (symbol) => {
      if (!finnhubEnabled) return null;
      try {
        const ex = exchangeForRow({
          symbol,
          name: symbol,
          exchange: parseSymbolParts(symbol).exchange ?? "US",
          logoUrl: null,
        });
        const profile = await fetchCompanyProfile(finnhubSymbol(symbol, ex));
        return profile.logoUrl?.trim() || null;
      } catch {
        return null;
      }
    },
  };
}

export async function runCompanyLogoBackfill(
  options: CompanyLogoBackfillOptions = {},
  deps: CompanyLogoBackfillDeps = createDefaultDeps(),
): Promise<CompanyLogoBackfillSummary> {
  const limit = Math.max(1, Math.min(10_000, options.limit ?? 500));
  const dryRun = options.dryRun ?? false;
  const force = options.force ?? false;
  const delayMs = options.delayMs ?? EODHD_DELAY_MS;

  const summary: CompanyLogoBackfillSummary = {
    scanned: 0,
    updated: 0,
    skippedNoProviderLogo: 0,
    skippedUnsafeMatch: 0,
    copiedFromExistingVariant: 0,
    fetchedFromEodhd: 0,
    fetchedFromFinnhub: 0,
    errors: 0,
    dryRun,
  };

  const missingWhere = force ? {} : { logoUrl: null };
  const targets = await deps.db.company.findMany({
    where: missingWhere,
    select: { symbol: true, name: true, exchange: true, logoUrl: true },
    orderBy: { symbol: "asc" },
    take: limit,
  });

  const donorsWithLogo = await deps.db.company.findMany({
    where: { logoUrl: { not: null } },
    select: { symbol: true, name: true, exchange: true, logoUrl: true },
  });

  const donorsByBase = indexCompaniesWithLogo(donorsWithLogo);

  for (const row of targets) {
    summary.scanned += 1;
    const target: CompanyLogoRow = {
      symbol: row.symbol,
      name: row.name,
      exchange: row.exchange,
      logoUrl: row.logoUrl,
    };

    if (!force && target.logoUrl?.trim()) {
      continue;
    }

    let resolvedLogo: string | null = null;
    let source: "variant" | "eodhd" | "finnhub" | null = null;

    try {
      const donorResult = pickLogoDonorFromVariants(target, donorsByBase);
      if (donorResult && "skipped" in donorResult) {
        summary.skippedUnsafeMatch += 1;
      } else if (donorResult && "donor" in donorResult) {
        resolvedLogo = donorResult.donor.logoUrl;
        source = "variant";
      }

      if (!resolvedLogo) {
        const ex = exchangeForRow(target);
        resolvedLogo = await deps.fetchEodhdLogo(target.symbol, ex);
        if (resolvedLogo) {
          source = "eodhd";
          await deps.sleep(delayMs);
        }
      }

      if (!resolvedLogo) {
        resolvedLogo = await deps.fetchFinnhubLogo(target.symbol);
        if (resolvedLogo) source = "finnhub";
      }

      if (!resolvedLogo) {
        summary.skippedNoProviderLogo += 1;
        continue;
      }

      if (!dryRun) {
        await deps.db.company.update({
          where: { symbol: target.symbol },
          data: { logoUrl: resolvedLogo },
        });
        const updatedRow: CompanyLogoRow = { ...target, logoUrl: resolvedLogo };
        const base = parseSymbolParts(target.symbol).base;
        const list = donorsByBase.get(base) ?? [];
        if (!list.some((r) => r.symbol === target.symbol)) {
          list.push(updatedRow);
          donorsByBase.set(base, list);
        }
      }

      summary.updated += 1;
      if (source === "variant") summary.copiedFromExistingVariant += 1;
      if (source === "eodhd") summary.fetchedFromEodhd += 1;
      if (source === "finnhub") summary.fetchedFromFinnhub += 1;
    } catch {
      summary.errors += 1;
    }
  }

  return summary;
}

export function formatBackfillSummary(summary: CompanyLogoBackfillSummary): string {
  return [
    `dryRun: ${summary.dryRun}`,
    `scanned: ${summary.scanned}`,
    `updated: ${summary.updated}`,
    `copiedFromExistingVariant: ${summary.copiedFromExistingVariant}`,
    `fetchedFromEodhd: ${summary.fetchedFromEodhd}`,
    `fetchedFromFinnhub: ${summary.fetchedFromFinnhub}`,
    `skippedNoProviderLogo: ${summary.skippedNoProviderLogo}`,
    `skippedUnsafeMatch: ${summary.skippedUnsafeMatch}`,
    `errors: ${summary.errors}`,
  ].join("\n");
}
