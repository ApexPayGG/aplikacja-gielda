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

type CompanySearchResultCandidate = CompanySearchResultItem & {
  source?: "db" | "eod";
};

const EODHD_BASE = "https://eodhd.com/api";
const SOURCE = "EODHD";
const IMPORT_DAYS = 365;
const REQUEST_DELAY_MS = 200;

/** Ranking bonus only — never overrides exact symbol / base-symbol tiers. */
export const PREFERRED_SEARCH_EXCHANGES = ["US", "WAR", "XETRA", "LSE"] as const;

const SEARCH_POOL_MAX = 50;
const SEARCH_POOL_MULTIPLIER = 8;

const RANK_EXACT_SYMBOL = 0;
const RANK_EXACT_BASE = 100;
const RANK_STARTS_WITH_SYMBOL = 200;
const RANK_EXACT_NAME = 300;
const RANK_CONTAINS_NAME = 400;
const RANK_SUFFIX_EXCHANGE_MISMATCH = 900;
const RANK_DEFAULT = 1000;

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

export function normalizeLogoUrl(value: unknown): string | null {
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

function searchPoolSize(limit: number): number {
  return Math.min(SEARCH_POOL_MAX, Math.max(limit, limit * SEARCH_POOL_MULTIPLIER));
}

export function parseSymbolParts(symbol: string): { base: string; exchange: string | null; full: string } {
  const full = symbol.trim().toUpperCase();
  const dot = full.lastIndexOf(".");
  if (dot > 0) {
    return { base: full.slice(0, dot), exchange: full.slice(dot + 1), full };
  }
  return { base: full, exchange: null, full };
}

export type NormalizedSearchQuery = {
  raw: string;
  upper: string;
  base: string;
  exchange: string | null;
  isTickerLike: boolean;
};

export function normalizeSearchQuery(raw: string): NormalizedSearchQuery {
  const trimmed = raw.trim();
  const upper = trimmed.toUpperCase();
  const parts = parseSymbolParts(upper);
  const isTickerLike = /^[A-Z0-9]{2,5}$/.test(parts.base);
  return {
    raw: trimmed,
    upper,
    base: parts.base,
    exchange: parts.exchange,
    isTickerLike,
  };
}

function preferredExchangeBonus(exchange: string | null): number {
  if (!exchange) return PREFERRED_SEARCH_EXCHANGES.length;
  const idx = PREFERRED_SEARCH_EXCHANGES.indexOf(exchange as (typeof PREFERRED_SEARCH_EXCHANGES)[number]);
  return idx === -1 ? PREFERRED_SEARCH_EXCHANGES.length : idx;
}

export function scoreSearchResult(query: NormalizedSearchQuery, item: CompanySearchResultItem): number {
  const sym = parseSymbolParts(item.symbol);
  const nameUpper = item.name.trim().toUpperCase();
  const q = query.upper;
  const qBase = query.base;

  if (sym.full === q) {
    return RANK_EXACT_SYMBOL;
  }

  if (sym.base === qBase) {
    if (query.isTickerLike && sym.exchange && sym.base !== sym.full) {
      return RANK_EXACT_BASE + preferredExchangeBonus(sym.exchange);
    }
    if (query.exchange && sym.exchange === query.exchange) {
      return RANK_EXACT_BASE + preferredExchangeBonus(sym.exchange);
    }
    return RANK_EXACT_BASE + preferredExchangeBonus(sym.exchange);
  }

  if (query.isTickerLike && sym.exchange === qBase && sym.base !== qBase) {
    return RANK_SUFFIX_EXCHANGE_MISMATCH;
  }

  if (qBase.length >= 2 && sym.base.startsWith(qBase)) {
    return RANK_STARTS_WITH_SYMBOL + (sym.base.length - qBase.length);
  }

  if (sym.full.includes(q) || sym.base.includes(q)) {
    return RANK_STARTS_WITH_SYMBOL + 50;
  }

  if (nameUpper === q) {
    return RANK_EXACT_NAME;
  }

  const qLower = query.raw.toLowerCase();
  if (qLower.length >= 2 && item.name.toLowerCase().includes(qLower)) {
    return RANK_CONTAINS_NAME;
  }

  return RANK_DEFAULT;
}

export function isUnknownSector(sector: string): boolean {
  return sector.trim().toLowerCase() === "unknown";
}

export function enrichmentScore(item: CompanySearchResultCandidate): number {
  return (
    (item.source === "db" ? 8 : 0) +
    (item.logoUrl ? 4 : 0) +
    (!isUnknownSector(item.sector) ? 2 : 0) +
    (item.exchange !== "UNKNOWN" ? 1 : 0)
  );
}

function pickBestEnrichedCandidate(items: CompanySearchResultCandidate[]): CompanySearchResultCandidate {
  return items.reduce((best, cur) => (enrichmentScore(cur) >= enrichmentScore(best) ? cur : best));
}

/** Resolve duplicate logo URLs across unrelated tickers without stripping DB-enriched rows. */
function pickLogoConflictKeeper(group: CompanySearchResultCandidate[]): CompanySearchResultCandidate {
  const dbEnriched = group.filter(
    (item) => item.source === "db" && item.logoUrl && !isUnknownSector(item.sector),
  );
  if (dbEnriched.length === 1) {
    return dbEnriched[0]!;
  }

  const usListing = group.find((item) => parseSymbolParts(item.symbol).exchange === "US");
  if (
    usListing &&
    group.some(
      (other) => other !== usListing && !areLikelySameCompanyName(other.name, usListing.name),
    )
  ) {
    return usListing;
  }

  return pickBestEnrichedCandidate(group);
}

const TRAILING_LISTING_SUFFIX =
  /\s+(incorporated|corporation|corp|ltd|limited|plc|llc|lp|class\s+[a-z0-9]+|adr|ads|vna|o\.?\s*n\.?)\s*$/i;
const TRAILING_INC_SUFFIX = /\s+inc\s*$/i;

/** Single-token stems that often collide across unrelated issuers (Merck DE vs US, ING PL vs NL). */
const AMBIGUOUS_NAME_STEMS = new Set([
  "merck",
  "ing",
  "co",
  "ten",
  "mrc",
  "peo",
  "bdx",
]);

const TOKEN_CANONICAL: Record<string, string> = {
  aktiengesellschaft: "ag",
  ag: "ag",
  societaseuropea: "se",
  se: "se",
};

const BENIGN_LISTING_SUFFIX_TOKENS = new Set([
  "class",
  "a",
  "b",
  "c",
  "vna",
  "on",
  "n",
  "ordinary",
  "shares",
  "adr",
  "ads",
]);

function normalizeCompanyNameForMatch(name: string): string {
  let value = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\./g, " ")
    .replace(/[,'’]/g, "")
    .replace(/&/g, " and ")
    .replace(/\s+/g, " ")
    .trim();
  while (TRAILING_LISTING_SUFFIX.test(value)) {
    value = value.replace(TRAILING_LISTING_SUFFIX, "").trim();
  }
  const tokenCount = value.split(" ").filter(Boolean).length;
  if (tokenCount >= 3 && TRAILING_INC_SUFFIX.test(value)) {
    value = value.replace(TRAILING_INC_SUFFIX, "").trim();
  }
  return value;
}

function tokenizeCompanyName(name: string): string[] {
  return normalizeCompanyNameForMatch(name).split(" ").filter(Boolean);
}

function canonicalizeNameToken(token: string): string {
  return TOKEN_CANONICAL[token] ?? token;
}

function canonicalNameTokens(name: string): string[] {
  return tokenizeCompanyName(name).map(canonicalizeNameToken);
}

function commonTokenPrefixLength(a: string[], b: string[]): number {
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i += 1;
  return i;
}

function isAmbiguousSingleWordStem(token: string): boolean {
  return token.length < 6 || AMBIGUOUS_NAME_STEMS.has(token);
}

function onlyBenignListingSuffixes(tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  const joined = tokens.join(" ");
  if (/^class [a-z0-9]$/i.test(joined)) return true;
  return tokens.every((token) => BENIGN_LISTING_SUFFIX_TOKENS.has(token));
}

function distinctiveSuffixesCompatible(a: string[], b: string[]): boolean {
  const left = a.map(canonicalizeNameToken).join(" ");
  const right = b.map(canonicalizeNameToken).join(" ");
  return left === right;
}

/** True when two issuer names likely refer to the same company (e.g. Tesla vs Tesla Inc). */
export function areLikelySameCompanyName(a: string, b: string): boolean {
  const ta = canonicalNameTokens(a);
  const tb = canonicalNameTokens(b);
  if (ta.length === 0 || tb.length === 0) return false;

  const joinedA = ta.join(" ");
  const joinedB = tb.join(" ");
  if (joinedA === joinedB) return true;

  const shorter = ta.length <= tb.length ? ta : tb;
  const longer = ta.length <= tb.length ? tb : ta;
  const prefixLen = commonTokenPrefixLength(shorter, longer);
  const restShort = shorter.slice(prefixLen);
  const restLong = longer.slice(prefixLen);

  if (prefixLen === shorter.length) {
    if (restLong.length === 0) return true;
    if (onlyBenignListingSuffixes(restLong)) return true;
    if (shorter.length === 1 && isAmbiguousSingleWordStem(shorter[0]!)) {
      return false;
    }
    // Multi-token base name with extra descriptive words (Apple Inc → Apple Inc Long Name).
    if (shorter.length >= 2) return true;
    return distinctiveSuffixesCompatible(restShort, restLong);
  }

  if (prefixLen > 0 && restShort.length > 0 && restLong.length > 0) {
    if (shorter.length === 1 && isAmbiguousSingleWordStem(shorter[0]!)) {
      return false;
    }
    return distinctiveSuffixesCompatible(restShort, restLong);
  }

  const shortJoined = shorter.join(" ");
  const longJoined = longer.join(" ");
  if (longJoined.includes(shortJoined)) {
    if (shorter.length === 1 && isAmbiguousSingleWordStem(shorter[0]!)) {
      return false;
    }
    const extra = longJoined.slice(shortJoined.length).trim().split(" ").filter(Boolean);
    return onlyBenignListingSuffixes(extra);
  }

  return false;
}

/** Exchange from symbol suffix, falling back to row metadata (bare tickers like TSLA often only have exchange on the row). */
export function listingExchange(item: CompanySearchResultCandidate): string | null {
  const fromSymbol = parseSymbolParts(item.symbol).exchange;
  if (fromSymbol) return fromSymbol;
  const ex = item.exchange?.trim().toUpperCase();
  return ex && ex !== "UNKNOWN" ? ex : null;
}

export function areSameIssuerListingGroup(items: CompanySearchResultCandidate[]): boolean {
  if (items.length < 2) return false;
  const anchor = items[0]!;
  return items.every(
    (item) => item === anchor || areLikelySameCompanyName(item.name, anchor.name),
  );
}

function hasSameIssuerPeerInLogoGroup(
  item: CompanySearchResultCandidate,
  group: CompanySearchResultCandidate[],
): boolean {
  return group.some(
    (other) => other !== item && areLikelySameCompanyName(item.name, other.name),
  );
}

function resolveMergedName(
  a: CompanySearchResultCandidate,
  b: CompanySearchResultCandidate,
): string {
  if (a.source === "db" && b.source !== "db") return a.name;
  if (b.source === "db" && a.source !== "db") return b.name;
  return a.name.length >= b.name.length ? a.name : b.name;
}

export function canShareEnrichedFieldsBetween(
  a: CompanySearchResultCandidate,
  b: CompanySearchResultCandidate,
): boolean {
  return areLikelySameCompanyName(a.name, b.name);
}

/** Copy only enrichable fields; never symbol, name, or listing exchange from another issuer. */
export function applySameIssuerEnrichment(
  target: CompanySearchResultCandidate,
  donor: CompanySearchResultCandidate,
): CompanySearchResultCandidate {
  if (!canShareEnrichedFieldsBetween(target, donor)) {
    return target;
  }
  return {
    ...target,
    logoUrl: target.logoUrl || donor.logoUrl,
    sector: !isUnknownSector(target.sector) ? target.sector : donor.sector,
    exchange: target.exchange !== "UNKNOWN" ? target.exchange : donor.exchange,
    source: target.source === "db" || donor.source === "db" ? "db" : target.source ?? donor.source,
  };
}

export function mergeSearchResultItems(
  a: CompanySearchResultCandidate,
  b: CompanySearchResultCandidate,
): CompanySearchResultCandidate {
  if (!canShareEnrichedFieldsBetween(a, b)) {
    if (a.source === "db" && b.source !== "db") return { ...a };
    if (b.source === "db" && a.source !== "db") return { ...b };
    return enrichmentScore(a) >= enrichmentScore(b) ? { ...a } : { ...b };
  }

  const preferPrimary = (() => {
    if (a.source === "db" && b.source !== "db") return a;
    if (b.source === "db" && a.source !== "db") return b;
    const score = (item: CompanySearchResultCandidate) =>
      (item.logoUrl ? 4 : 0) + (!isUnknownSector(item.sector) ? 2 : 0) + (item.exchange !== "UNKNOWN" ? 1 : 0);
    return score(a) >= score(b) ? a : b;
  })();
  const secondary = preferPrimary === a ? b : a;

  return {
    symbol: preferPrimary.symbol,
    name: resolveMergedName(a, b),
    exchange:
      preferPrimary.exchange !== "UNKNOWN" && preferPrimary.exchange
        ? preferPrimary.exchange
        : secondary.exchange,
    sector: !isUnknownSector(preferPrimary.sector)
      ? preferPrimary.sector
      : !isUnknownSector(secondary.sector)
        ? secondary.sector
        : preferPrimary.sector,
    logoUrl: a.logoUrl || b.logoUrl,
    source: a.source === "db" || b.source === "db" ? "db" : a.source ?? b.source,
  };
}

/** Share logo/sector only across listings of the same issuer (name match), never by base ticker alone. */
export function propagateEnrichedFieldsByBase(
  items: CompanySearchResultCandidate[],
): CompanySearchResultCandidate[] {
  return items.map((item) => {
    let enriched = item;
    for (const peer of items) {
      if (peer.symbol.toUpperCase() === item.symbol.toUpperCase()) continue;
      if (parseSymbolParts(peer.symbol).base !== parseSymbolParts(item.symbol).base) continue;
      if (!canShareEnrichedFieldsBetween(item, peer)) continue;
      const donor = enrichmentScore(peer) > enrichmentScore(enriched) ? peer : enriched;
      enriched = applySameIssuerEnrichment(enriched, donor);
    }
    return enriched;
  });
}

export function sanitizeCrossSymbolLogos(
  items: CompanySearchResultCandidate[],
): CompanySearchResultCandidate[] {
  const byLogo = new Map<string, CompanySearchResultCandidate[]>();
  for (const item of items) {
    if (!item.logoUrl) continue;
    const list = byLogo.get(item.logoUrl) ?? [];
    list.push(item);
    byLogo.set(item.logoUrl, list);
  }

  const symbolsToClear = new Set<string>();

  for (const group of byLogo.values()) {
    if (group.length < 2) continue;
    const keeper = pickLogoConflictKeeper(group);

    const byBase = new Map<string, CompanySearchResultCandidate[]>();
    for (const item of group) {
      const base = parseSymbolParts(item.symbol).base;
      const list = byBase.get(base) ?? [];
      list.push(item);
      byBase.set(base, list);
    }

    for (const sameBase of byBase.values()) {
      if (sameBase.length < 2) continue;
      if (areSameIssuerListingGroup(sameBase)) continue;

      const ranked = [...sameBase].sort((a, b) => {
        return preferredExchangeBonus(listingExchange(a)) - preferredExchangeBonus(listingExchange(b));
      });
      const baseKeeper = ranked[0]!;
      for (const item of sameBase) {
        if (item.symbol.toUpperCase() === baseKeeper.symbol.toUpperCase()) continue;
        if (!areLikelySameCompanyName(item.name, baseKeeper.name)) {
          symbolsToClear.add(item.symbol.toUpperCase());
        }
      }
    }

    const distinctBases = new Set(group.map((i) => parseSymbolParts(i.symbol).base));
    if (distinctBases.size > 1) {
      for (const item of group) {
        if (hasSameIssuerPeerInLogoGroup(item, group)) continue;
        if (item.symbol.toUpperCase() === keeper.symbol.toUpperCase()) continue;
        if (areLikelySameCompanyName(item.name, keeper.name)) continue;
        symbolsToClear.add(item.symbol.toUpperCase());
      }
    }
  }

  return items.map((item) => {
    if (!item.logoUrl) return item;
    if (symbolsToClear.has(item.symbol.toUpperCase())) {
      return { ...item, logoUrl: null };
    }
    return item;
  });
}

export function searchResultQualityScore(item: CompanySearchResultItem): number {
  const exchange = parseSymbolParts(item.symbol).exchange;
  return (
    (item.logoUrl ? 8 : 0) +
    (!isUnknownSector(item.sector) ? 4 : 0) +
    (PREFERRED_SEARCH_EXCHANGES.length - preferredExchangeBonus(exchange))
  );
}

export function rankCompanySearchResults(
  query: string,
  items: CompanySearchResultItem[],
): CompanySearchResultItem[] {
  const normalized = normalizeSearchQuery(query);
  return [...items].sort((a, b) => {
    const scoreA = scoreSearchResult(normalized, a);
    const scoreB = scoreSearchResult(normalized, b);
    if (scoreA !== scoreB) return scoreA - scoreB;
    const exA = preferredExchangeBonus(parseSymbolParts(a.symbol).exchange);
    const exB = preferredExchangeBonus(parseSymbolParts(b.symbol).exchange);
    if (exA !== exB) return exA - exB;
    const qualityA = searchResultQualityScore(a);
    const qualityB = searchResultQualityScore(b);
    if (qualityA !== qualityB) return qualityB - qualityA;
    return a.symbol.localeCompare(b.symbol);
  });
}

function mergeBySymbol(items: CompanySearchResultCandidate[]): CompanySearchResultCandidate[] {
  const map = new Map<string, CompanySearchResultCandidate>();
  for (const row of items) {
    const key = row.symbol.trim().toUpperCase();
    if (!key) continue;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, { ...row });
      continue;
    }
    map.set(key, mergeSearchResultItems(prev, row));
  }
  return [...map.values()];
}

function stripSearchCandidateMeta(item: CompanySearchResultCandidate): CompanySearchResultItem {
  const { source: _source, ...rest } = item;
  return rest;
}

export function finalizeSearchResults(
  query: string,
  items: CompanySearchResultCandidate[],
  limit: number,
): CompanySearchResultItem[] {
  const merged = mergeBySymbol(items);
  const propagated = propagateEnrichedFieldsByBase(merged);
  const sanitized = sanitizeCrossSymbolLogos(propagated).map(stripSearchCandidateMeta);
  return rankCompanySearchResults(query, sanitized).slice(0, limit);
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
    const dbRows = await searchCompanies(query, searchPoolSize(limit));
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
  const dbCandidates: CompanySearchResultCandidate[] = dbRows.map((row) => ({ ...row, source: "db" }));
  let combined: CompanySearchResultCandidate[] = [...dbCandidates];
  let results = finalizeSearchResults(q, combined, take);

  if (results.length < 3) {
    try {
      const eodRows = await dependencies.searchEod(q, searchPoolSize(take));
      const eodCandidates: CompanySearchResultCandidate[] = eodRows.map((row) => ({
        ...row,
        source: "eod",
      }));
      combined = [...dbCandidates, ...eodCandidates];
      results = finalizeSearchResults(q, combined, take);
    } catch (error) {
      console.warn("[companies.search] eod fallback failed", error);
    }
  }

  return results;
}
