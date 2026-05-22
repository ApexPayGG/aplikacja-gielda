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
  skippedProviderNameMismatch: number;
  copiedFromExistingVariant: number;
  fetchedFromEodhd: number;
  fetchedFromFinnhub: number;
  errors: number;
  dryRun: boolean;
};

export type LogoBackfillSource = "dbVariant" | "eodhd" | "finnhub";

export type PlannedLogoUpdate = {
  symbol: string;
  name: string;
  exchange: string;
  oldLogoUrl: string | null;
  newLogoUrl: string;
  source: LogoBackfillSource;
  donorSymbol?: string;
};

export type UnsafeVariantSkip = {
  targetSymbol: string;
  targetName: string;
  donorSymbol: string;
  donorName: string;
  reason: string;
};

export type ProviderNameMismatchSkip = {
  targetSymbol: string;
  targetName: string;
  targetExchange: string;
  provider: "eodhd" | "finnhub";
  providerSymbol: string | null;
  providerName: string | null;
  providerExchange: string | null;
  reason: string;
};

export type LogoBackfillError = {
  symbol: string;
  step: string;
  message: string;
};

export type ProviderLogoCandidate = {
  logoUrl: string;
  name: string | null;
  symbol: string | null;
  exchange: string | null;
};

export type CompanyLogoBackfillLog = {
  plannedUpdates: PlannedLogoUpdate[];
  unsafeSkips: UnsafeVariantSkip[];
  providerNameMismatches: ProviderNameMismatchSkip[];
  errors: LogoBackfillError[];
};

export type CompanyLogoBackfillResult = {
  summary: CompanyLogoBackfillSummary;
  log: CompanyLogoBackfillLog;
};

export type CompanyLogoBackfillOptions = {
  limit?: number;
  dryRun?: boolean;
  force?: boolean;
  delayMs?: number;
  verbose?: boolean;
};

export type CompanyLogoBackfillDeps = {
  db: {
    company: {
      findMany: PrismaClient["company"]["findMany"];
      update: PrismaClient["company"]["update"];
    };
  };
  fetchEodhd: (symbol: string, exchange: string) => Promise<ProviderLogoCandidate | null>;
  fetchFinnhub: (symbol: string, exchange: string) => Promise<ProviderLogoCandidate | null>;
  sleep: (ms: number) => Promise<void>;
};

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toStr(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim();
  return v ? v : null;
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

function finnhubQuerySymbol(symbol: string, exchange: string): string {
  const parts = parseSymbolParts(symbol);
  if (parts.exchange === "US" || exchange === "US") return parts.base;
  return parts.full.includes(".") ? parts.base : symbol;
}

const PROVIDER_NAME_MISMATCH_REASON =
  "provider company identity does not match target issuer (name validation failed)";

const BARE_TICKER_NO_NAME_REASON =
  "bare ticker without exchange suffix — provider logo rejected without matching company name";

const EXCHANGE_MISMATCH_REASON =
  "provider exchange does not match target listing exchange";

const SYMBOL_MISMATCH_NO_NAME_REASON =
  "listed symbol with suffix requires matching provider symbol when provider name is missing";

export function acceptProviderLogoForTarget(
  target: CompanyLogoRow,
  candidate: ProviderLogoCandidate,
): { accepted: true; logoUrl: string } | { accepted: false; reason: string } {
  const logoUrl = candidate.logoUrl?.trim();
  if (!logoUrl) {
    return { accepted: false, reason: "provider returned no logo URL" };
  }

  const providerName = candidate.name?.trim();
  if (providerName) {
    if (areLikelySameCompanyName(providerName, target.name)) {
      return { accepted: true, logoUrl };
    }
    return { accepted: false, reason: PROVIDER_NAME_MISMATCH_REASON };
  }

  const targetParts = parseSymbolParts(target.symbol);
  if (!targetParts.exchange) {
    return { accepted: false, reason: BARE_TICKER_NO_NAME_REASON };
  }

  const targetEx = exchangeForRow(target);
  const providerEx = candidate.exchange?.trim().toUpperCase() ?? null;
  if (providerEx && providerEx !== targetEx) {
    return { accepted: false, reason: EXCHANGE_MISMATCH_REASON };
  }

  const providerSymbol = candidate.symbol?.trim().toUpperCase() ?? null;
  if (providerSymbol && providerSymbol === target.symbol.trim().toUpperCase()) {
    return { accepted: true, logoUrl };
  }

  return { accepted: false, reason: SYMBOL_MISMATCH_NO_NAME_REASON };
}

export function buildProviderNameMismatchSkip(
  target: CompanyLogoRow,
  candidate: ProviderLogoCandidate,
  provider: "eodhd" | "finnhub",
  reason: string,
): ProviderNameMismatchSkip {
  return {
    targetSymbol: target.symbol,
    targetName: target.name,
    targetExchange: exchangeForRow(target),
    provider,
    providerSymbol: candidate.symbol,
    providerName: candidate.name,
    providerExchange: candidate.exchange,
    reason,
  };
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

const UNSAFE_VARIANT_REASON =
  "same base ticker but company names do not match (cross-company contamination guard)";

export function listUnsafeVariantSkips(
  target: CompanyLogoRow,
  donorsByBase: Map<string, CompanyLogoRow[]>,
): UnsafeVariantSkip[] {
  const base = parseSymbolParts(target.symbol).base;
  const peers = donorsByBase.get(base) ?? [];
  return peers
    .filter((peer) => peer.logoUrl?.trim() && peer.symbol !== target.symbol)
    .filter((peer) => !areLikelySameCompanyName(peer.name, target.name))
    .map((peer) => ({
      targetSymbol: target.symbol,
      targetName: target.name,
      donorSymbol: peer.symbol,
      donorName: peer.name,
      reason: UNSAFE_VARIANT_REASON,
    }));
}

function sanitizeErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  return raw
    .replace(/api_token=[^&\s"']+/gi, "api_token=***")
    .replace(/token=[^&\s"']+/gi, "token=***")
    .replace(/Bearer\s+\S+/gi, "Bearer ***")
    .trim()
    .slice(0, 240);
}

function emptyBackfillLog(): CompanyLogoBackfillLog {
  return { plannedUpdates: [], unsafeSkips: [], providerNameMismatches: [], errors: [] };
}

function sourceLabel(source: LogoBackfillSource): string {
  if (source === "dbVariant") return "dbVariant";
  if (source === "eodhd") return "eodhd";
  return "finnhub";
}

export async function fetchEodhdFundamentalsIdentity(
  symbol: string,
  exchange: string,
  apiToken: string,
): Promise<ProviderLogoCandidate | null> {
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
  const logoUrl = normalizeLogoUrl(general.LogoURL ?? general.Logo);
  if (!logoUrl) return null;
  return {
    logoUrl,
    name: toStr(general.Name),
    symbol: eodTicker,
    exchange: exchange.trim().toUpperCase() || parseSymbolParts(eodTicker).exchange,
  };
}

/** @deprecated Use fetchEodhdFundamentalsIdentity — logo only, no name validation. */
export async function fetchEodhdFundamentalsLogo(
  symbol: string,
  exchange: string,
  apiToken: string,
): Promise<string | null> {
  const row = await fetchEodhdFundamentalsIdentity(symbol, exchange, apiToken);
  return row?.logoUrl ?? null;
}

function recordProviderRejection(
  target: CompanyLogoRow,
  candidate: ProviderLogoCandidate,
  provider: "eodhd" | "finnhub",
  reason: string,
  summary: CompanyLogoBackfillSummary,
  log: CompanyLogoBackfillLog,
  verbose: boolean,
): void {
  summary.skippedProviderNameMismatch += 1;
  if (verbose) {
    log.providerNameMismatches.push(buildProviderNameMismatchSkip(target, candidate, provider, reason));
  }
}

function createDefaultDeps(): CompanyLogoBackfillDeps {
  const eodToken = process.env.EODHD_API_KEY?.trim();
  const finnhubEnabled = Boolean(process.env.FINNHUB_API_KEY?.trim());

  return {
    db: defaultPrisma,
    sleep: sleepMs,
    fetchEodhd: async (symbol, exchange) => {
      if (!eodToken) return null;
      return fetchEodhdFundamentalsIdentity(symbol, exchange, eodToken);
    },
    fetchFinnhub: async (symbol, exchange) => {
      if (!finnhubEnabled) return null;
      try {
        const profile = await fetchCompanyProfile(finnhubQuerySymbol(symbol, exchange));
        const logoUrl = profile.logoUrl?.trim();
        if (!logoUrl) return null;
        return {
          logoUrl,
          name: profile.name?.trim() || null,
          symbol: profile.symbol?.trim().toUpperCase() || finnhubQuerySymbol(symbol, exchange),
          exchange,
        };
      } catch {
        return null;
      }
    },
  };
}

export async function runCompanyLogoBackfill(
  options: CompanyLogoBackfillOptions = {},
  deps: CompanyLogoBackfillDeps = createDefaultDeps(),
): Promise<CompanyLogoBackfillResult> {
  const limit = Math.max(1, Math.min(10_000, options.limit ?? 500));
  const dryRun = options.dryRun ?? false;
  const force = options.force ?? false;
  const delayMs = options.delayMs ?? EODHD_DELAY_MS;
  const verbose = options.verbose ?? false;
  const log = emptyBackfillLog();

  const summary: CompanyLogoBackfillSummary = {
    scanned: 0,
    updated: 0,
    skippedNoProviderLogo: 0,
    skippedUnsafeMatch: 0,
    skippedProviderNameMismatch: 0,
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
    let source: LogoBackfillSource | null = null;
    let donorSymbol: string | undefined;
    let step = "resolve";

    try {
      const donorResult = pickLogoDonorFromVariants(target, donorsByBase);
      if (donorResult && "skipped" in donorResult) {
        summary.skippedUnsafeMatch += 1;
        if (verbose) {
          log.unsafeSkips.push(...listUnsafeVariantSkips(target, donorsByBase));
        }
      } else if (donorResult && "donor" in donorResult) {
        resolvedLogo = donorResult.donor.logoUrl;
        source = "dbVariant";
        donorSymbol = donorResult.donor.symbol;
      }

      if (!resolvedLogo) {
        step = "eodhd";
        const ex = exchangeForRow(target);
        const eodCandidate = await deps.fetchEodhd(target.symbol, ex);
        if (eodCandidate) {
          const validated = acceptProviderLogoForTarget(target, eodCandidate);
          if (validated.accepted) {
            resolvedLogo = validated.logoUrl;
            source = "eodhd";
            await deps.sleep(delayMs);
          } else {
            recordProviderRejection(target, eodCandidate, "eodhd", validated.reason, summary, log, verbose);
          }
        }
      }

      if (!resolvedLogo) {
        step = "finnhub";
        const ex = exchangeForRow(target);
        const finnhubCandidate = await deps.fetchFinnhub(target.symbol, ex);
        if (finnhubCandidate) {
          const validated = acceptProviderLogoForTarget(target, finnhubCandidate);
          if (validated.accepted) {
            resolvedLogo = validated.logoUrl;
            source = "finnhub";
          } else {
            recordProviderRejection(target, finnhubCandidate, "finnhub", validated.reason, summary, log, verbose);
          }
        }
      }

      if (!resolvedLogo) {
        summary.skippedNoProviderLogo += 1;
        continue;
      }

      if (!dryRun) {
        step = "persist";
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
      if (source === "dbVariant") summary.copiedFromExistingVariant += 1;
      if (source === "eodhd") summary.fetchedFromEodhd += 1;
      if (source === "finnhub") summary.fetchedFromFinnhub += 1;

      if (verbose && source) {
        log.plannedUpdates.push({
          symbol: target.symbol,
          name: target.name,
          exchange: exchangeForRow(target),
          oldLogoUrl: target.logoUrl,
          newLogoUrl: resolvedLogo,
          source,
          ...(donorSymbol ? { donorSymbol } : {}),
        });
      }
    } catch (error) {
      summary.errors += 1;
      if (verbose) {
        log.errors.push({
          symbol: target.symbol,
          step,
          message: sanitizeErrorMessage(error),
        });
      }
    }
  }

  return { summary, log };
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
    `skippedProviderNameMismatch: ${summary.skippedProviderNameMismatch}`,
    `errors: ${summary.errors}`,
  ].join("\n");
}

function formatLogoUrl(value: string | null): string {
  return value?.trim() ? value.trim() : "(null)";
}

function formatNullable(value: string | null): string {
  return value?.trim() ? value.trim() : "(null)";
}

export function formatBackfillVerboseLog(
  result: CompanyLogoBackfillResult,
  options: { dryRun: boolean },
): string {
  const lines: string[] = [];
  const { log } = result;

  if (options.dryRun && log.plannedUpdates.length > 0) {
    lines.push("--- planned updates (dry-run) ---");
    for (const row of log.plannedUpdates) {
      lines.push(
        [
          `symbol: ${row.symbol}`,
          `name: ${row.name}`,
          `exchange: ${row.exchange}`,
          `oldLogoUrl: ${formatLogoUrl(row.oldLogoUrl)}`,
          `newLogoUrl: ${row.newLogoUrl}`,
          `source: ${sourceLabel(row.source)}`,
          ...(row.donorSymbol ? [`donorSymbol: ${row.donorSymbol}`] : []),
        ].join("\n  "),
      );
      lines.push("");
    }
  }

  if (log.unsafeSkips.length > 0) {
    lines.push("--- skippedUnsafeMatch ---");
    for (const row of log.unsafeSkips) {
      lines.push(
        [
          `target: ${row.targetSymbol} (${row.targetName})`,
          `donor: ${row.donorSymbol} (${row.donorName})`,
          `reason: ${row.reason}`,
        ].join("\n  "),
      );
      lines.push("");
    }
  }

  if (log.providerNameMismatches.length > 0) {
    lines.push("--- skippedProviderNameMismatch ---");
    for (const row of log.providerNameMismatches) {
      lines.push(
        [
          `target: ${row.targetSymbol} (${row.targetName}) exchange=${row.targetExchange}`,
          `provider: ${row.provider}`,
          `providerSymbol: ${formatNullable(row.providerSymbol)}`,
          `providerName: ${formatNullable(row.providerName)}`,
          `providerExchange: ${formatNullable(row.providerExchange)}`,
          `reason: ${row.reason}`,
        ].join("\n  "),
      );
      lines.push("");
    }
  }

  if (log.errors.length > 0) {
    lines.push("--- errors ---");
    for (const row of log.errors) {
      lines.push(
        [`symbol: ${row.symbol}`, `step: ${row.step}`, `message: ${row.message}`].join("\n  "),
      );
      lines.push("");
    }
  }

  return lines.join("\n").trimEnd();
}
