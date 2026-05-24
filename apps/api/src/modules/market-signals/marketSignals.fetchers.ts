import { parseMarketSignalProvider } from "./marketSignals.ingestion";
import {
  enqueueProviderPayload,
  type MarketSignalEnqueueResult,
} from "./marketSignals.queue";
import type {
  MarketSignalFetchEnqueueResult,
  MarketSignalFetchErrorCode,
  MarketSignalFetchResult,
  MarketSignalProvider,
} from "./marketSignals.types";

export const FETCH_TICKER_PATTERN = /^[A-Z0-9.\-]{1,16}$/;

const POLYGON_BASE = "https://api.polygon.io";
const EODHD_INSIDER_BASE = "https://eodhd.com/api/insider-transactions";
const SEC_COMPANY_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const SEC_SUBMISSIONS_BASE = "https://data.sec.gov/submissions";

export const DEFAULT_FETCH_TIMEOUT_MS = 8000;

export type MarketSignalFetcherDeps = {
  fetchFn?: typeof fetch;
  now?: () => Date;
  timeoutMs?: number;
  getEnv?: (key: string) => string | undefined;
};

type SafeFetchJsonResult =
  | { ok: true; status: number; json: unknown }
  | {
      ok: false;
      errorCode: "TIMEOUT" | "HTTP_ERROR" | "PROVIDER_ERROR";
      statusCode?: number;
      message: string;
    };

function defaultGetEnv(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

export function normalizeFetchTicker(raw: string): string | null {
  const normalized = raw.trim().toUpperCase();
  if (!FETCH_TICKER_PATTERN.test(normalized)) return null;
  return normalized;
}

export function redactSecretsFromText(text: string, secrets: string[]): string {
  let output = text;
  for (const secret of secrets) {
    if (!secret) continue;
    output = output.split(secret).join("[REDACTED]");
  }
  return output.replace(/apiKey=[^&\s]+/gi, "apiKey=[REDACTED]").replace(/api_token=[^&\s]+/gi, "api_token=[REDACTED]");
}

export function redactUrl(url: string, secrets: string[] = []): string {
  return redactSecretsFromText(url, secrets);
}

export function createTimeoutSignal(
  timeoutMs: number,
): { signal: AbortSignal; cleanup: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    cleanup: () => clearTimeout(timer),
  };
}

function resolveFetcherDeps(deps?: MarketSignalFetcherDeps): Required<Pick<MarketSignalFetcherDeps, "fetchFn" | "now" | "timeoutMs" | "getEnv">> &
  MarketSignalFetcherDeps {
  return {
    fetchFn: deps?.fetchFn ?? fetch,
    now: deps?.now ?? (() => new Date()),
    timeoutMs: deps?.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS,
    getEnv: deps?.getEnv ?? defaultGetEnv,
  };
}

function invalidTickerResult(
  provider: MarketSignalProvider,
  ticker: string,
  emptyPayload: unknown,
): MarketSignalFetchResult {
  return {
    ok: false,
    provider,
    ticker,
    errorCode: "INVALID_TICKER",
    payload: emptyPayload,
  };
}

function missingApiKeyResult(
  provider: MarketSignalProvider,
  ticker: string,
  emptyPayload: unknown,
): MarketSignalFetchResult {
  return {
    ok: false,
    provider,
    ticker,
    errorCode: "MISSING_API_KEY",
    payload: emptyPayload,
  };
}

function missingSecUserAgentResult(ticker: string, emptyPayload: unknown): MarketSignalFetchResult {
  return {
    ok: false,
    provider: "SEC_FILINGS",
    ticker,
    errorCode: "MISSING_SEC_USER_AGENT",
    payload: emptyPayload,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function mapPolygonTimestamp(value: unknown): string | undefined {
  const numeric = toNumber(value);
  if (numeric == null) return undefined;
  const millis = numeric > 1_000_000_000_000_000 ? Math.floor(numeric / 1_000_000) : numeric;
  const parsed = new Date(millis);
  if (Number.isNaN(parsed.getTime())) return undefined;
  return parsed.toISOString();
}

async function safeFetchJson(
  url: string,
  init: RequestInit,
  deps: ReturnType<typeof resolveFetcherDeps>,
  secrets: string[] = [],
): Promise<SafeFetchJsonResult> {
  const timeout = createTimeoutSignal(deps.timeoutMs);
  try {
    const response = await deps.fetchFn(url, {
      ...init,
      signal: timeout.signal,
    });
    const bodyText = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        errorCode: "HTTP_ERROR",
        statusCode: response.status,
        message: redactSecretsFromText(
          `HTTP ${response.status} for ${redactUrl(url, secrets)}: ${bodyText.slice(0, 200)}`,
          secrets,
        ),
      };
    }

    try {
      return {
        ok: true,
        status: response.status,
        json: JSON.parse(bodyText) as unknown,
      };
    } catch {
      return {
        ok: false,
        errorCode: "PROVIDER_ERROR",
        statusCode: response.status,
        message: redactSecretsFromText(
          `Invalid JSON from ${redactUrl(url, secrets)}: ${bodyText.slice(0, 200)}`,
          secrets,
        ),
      };
    }
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return {
        ok: false,
        errorCode: "TIMEOUT",
        message: redactSecretsFromText(`Timeout fetching ${redactUrl(url, secrets)}`, secrets),
      };
    }
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      errorCode: "PROVIDER_ERROR",
      message: redactSecretsFromText(message, secrets),
    };
  } finally {
    timeout.cleanup();
  }
}

function mapPolygonTradeToAdapterRow(
  trade: Record<string, unknown>,
  ticker: string,
): Record<string, unknown> {
  const trfId = trade.trf_id;
  const exchange =
    trfId != null && String(trfId).trim() !== ""
      ? "DARK"
      : String(trade.exchange ?? trade.trf_id ?? "");

  return {
    ticker,
    price: trade.price,
    size: trade.size,
    exchange,
    sip_timestamp: mapPolygonTimestamp(trade.sip_timestamp ?? trade.participant_timestamp),
  };
}

function mapPolygonOptionsSnapshotToAdapterRow(
  entry: Record<string, unknown>,
  ticker: string,
): Record<string, unknown> | null {
  const details = isRecord(entry.details) ? entry.details : null;
  const day = isRecord(entry.day) ? entry.day : null;
  const lastTrade = isRecord(entry.last_trade) ? entry.last_trade : null;
  if (!details) return null;

  const volume = toNumber(day?.volume) ?? toNumber(lastTrade?.size) ?? 0;
  const tradePrice = toNumber(lastTrade?.price) ?? toNumber(entry.fmv) ?? 0;
  const premium = tradePrice > 0 && volume > 0 ? tradePrice * volume * 100 : 0;

  return {
    ticker: String(details.ticker ?? ticker),
    underlying_ticker: ticker,
    contract_type: details.contract_type,
    expiration_date: details.expiration_date,
    strike_price: details.strike_price,
    volume,
    open_interest: toNumber(entry.open_interest) ?? 0,
    premium,
    trade_timestamp: mapPolygonTimestamp(lastTrade?.sip_timestamp ?? lastTrade?.timestamp),
  };
}

function resolveEodhdInsiderCode(ticker: string): string {
  return ticker.includes(".") ? ticker : `${ticker}.US`;
}

function padSecCik(cik: number): string {
  return String(cik).padStart(10, "0");
}

export async function fetchPolygonDarkPoolPayload(
  tickerInput: string,
  depsInput?: MarketSignalFetcherDeps,
): Promise<MarketSignalFetchResult> {
  const deps = resolveFetcherDeps(depsInput);
  const ticker = normalizeFetchTicker(tickerInput);
  const emptyPayload = { results: [] as unknown[] };
  if (!ticker) {
    return invalidTickerResult("POLYGON_DARK_POOL", tickerInput.trim().toUpperCase(), emptyPayload);
  }

  const apiKey = deps.getEnv("POLYGON_API_KEY");
  if (!apiKey) {
    return missingApiKeyResult("POLYGON_DARK_POOL", ticker, emptyPayload);
  }

  const url = `${POLYGON_BASE}/v3/trades/${encodeURIComponent(ticker)}?limit=50&order=desc&sort=timestamp&apiKey=${encodeURIComponent(apiKey)}`;
  const fetched = await safeFetchJson(url, { headers: { Accept: "application/json" } }, deps, [apiKey]);
  if (!fetched.ok) {
    return {
      ok: false,
      provider: "POLYGON_DARK_POOL",
      ticker,
      payload: emptyPayload,
      errorCode: fetched.errorCode,
      statusCode: fetched.statusCode,
    };
  }

  const json = fetched.json;
  const rawResults = isRecord(json) && Array.isArray(json.results) ? json.results : [];
  const results = rawResults
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .map((entry) => mapPolygonTradeToAdapterRow(entry, ticker));

  return {
    ok: true,
    provider: "POLYGON_DARK_POOL",
    ticker,
    payload: { results },
  };
}

export async function fetchPolygonOptionsFlowPayload(
  tickerInput: string,
  depsInput?: MarketSignalFetcherDeps,
): Promise<MarketSignalFetchResult> {
  const deps = resolveFetcherDeps(depsInput);
  const ticker = normalizeFetchTicker(tickerInput);
  const emptyPayload = { results: [] as unknown[] };
  if (!ticker) {
    return invalidTickerResult("POLYGON_OPTIONS_FLOW", tickerInput.trim().toUpperCase(), emptyPayload);
  }

  const apiKey = deps.getEnv("POLYGON_API_KEY");
  if (!apiKey) {
    return missingApiKeyResult("POLYGON_OPTIONS_FLOW", ticker, emptyPayload);
  }

  const url = `${POLYGON_BASE}/v3/snapshot/options/${encodeURIComponent(ticker)}?limit=10&apiKey=${encodeURIComponent(apiKey)}`;
  const fetched = await safeFetchJson(url, { headers: { Accept: "application/json" } }, deps, [apiKey]);
  if (!fetched.ok) {
    return {
      ok: false,
      provider: "POLYGON_OPTIONS_FLOW",
      ticker,
      payload: emptyPayload,
      errorCode: fetched.errorCode,
      statusCode: fetched.statusCode,
    };
  }

  const json = fetched.json;
  const rawResults = isRecord(json) && Array.isArray(json.results) ? json.results : [];
  const results = rawResults
    .filter((entry): entry is Record<string, unknown> => isRecord(entry))
    .map((entry) => mapPolygonOptionsSnapshotToAdapterRow(entry, ticker))
    .filter((entry): entry is Record<string, unknown> => entry != null);

  return {
    ok: true,
    provider: "POLYGON_OPTIONS_FLOW",
    ticker,
    payload: { results },
  };
}

export async function fetchEodhdInsiderActivityPayload(
  tickerInput: string,
  depsInput?: MarketSignalFetcherDeps,
): Promise<MarketSignalFetchResult> {
  const deps = resolveFetcherDeps(depsInput);
  const ticker = normalizeFetchTicker(tickerInput);
  const emptyPayload = { data: [] as unknown[] };
  if (!ticker) {
    return invalidTickerResult("EODHD_INSIDER_ACTIVITY", tickerInput.trim().toUpperCase(), emptyPayload);
  }

  const apiKey = deps.getEnv("EODHD_API_KEY");
  if (!apiKey) {
    return missingApiKeyResult("EODHD_INSIDER_ACTIVITY", ticker, emptyPayload);
  }

  const code = resolveEodhdInsiderCode(ticker);
  const params = new URLSearchParams({
    code,
    api_token: apiKey,
    fmt: "json",
  });
  const url = `${EODHD_INSIDER_BASE}?${params.toString()}`;
  const fetched = await safeFetchJson(url, { headers: { Accept: "application/json" } }, deps, [apiKey]);
  if (!fetched.ok) {
    return {
      ok: false,
      provider: "EODHD_INSIDER_ACTIVITY",
      ticker,
      payload: emptyPayload,
      errorCode: fetched.errorCode,
      statusCode: fetched.statusCode,
    };
  }

  const data = Array.isArray(fetched.json) ? fetched.json : [];
  return {
    ok: true,
    provider: "EODHD_INSIDER_ACTIVITY",
    ticker,
    payload: { data },
  };
}

async function resolveSecCik(
  ticker: string,
  deps: ReturnType<typeof resolveFetcherDeps>,
  userAgent: string,
): Promise<number | null> {
  const fetched = await safeFetchJson(
    SEC_COMPANY_TICKERS_URL,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": userAgent,
      },
    },
    deps,
  );
  if (!fetched.ok || !isRecord(fetched.json)) return null;

  for (const value of Object.values(fetched.json)) {
    if (!isRecord(value)) continue;
    const entryTicker = String(value.ticker ?? "").trim().toUpperCase();
    const cik = toNumber(value.cik_str ?? value.cik);
    if (entryTicker === ticker && cik != null) {
      return Math.trunc(cik);
    }
  }
  return null;
}

function mapSecFilingRow(
  ticker: string,
  form: unknown,
  accessionNumber: unknown,
  filedAt: unknown,
  description: unknown,
): Record<string, unknown> {
  const filedRaw = String(filedAt ?? "").trim();
  const filedIso = filedRaw.includes("T") ? filedRaw : `${filedRaw}T00:00:00.000Z`;
  return {
    ticker,
    form: String(form ?? "").trim(),
    accessionNumber: String(accessionNumber ?? "").trim(),
    filedAt: filedIso,
    description: String(description ?? "").trim() || undefined,
  };
}

export async function fetchSecFilingsPayload(
  tickerInput: string,
  depsInput?: MarketSignalFetcherDeps,
): Promise<MarketSignalFetchResult> {
  const deps = resolveFetcherDeps(depsInput);
  const ticker = normalizeFetchTicker(tickerInput);
  const emptyPayload = { filings: [] as unknown[] };
  if (!ticker) {
    return invalidTickerResult("SEC_FILINGS", tickerInput.trim().toUpperCase(), emptyPayload);
  }

  const userAgent = deps.getEnv("SEC_USER_AGENT");
  if (!userAgent) {
    return missingSecUserAgentResult(ticker, emptyPayload);
  }

  const cik = await resolveSecCik(ticker, deps, userAgent);
  if (cik == null) {
    return {
      ok: false,
      provider: "SEC_FILINGS",
      ticker,
      payload: emptyPayload,
      errorCode: "PROVIDER_ERROR",
    };
  }

  const submissionsUrl = `${SEC_SUBMISSIONS_BASE}/CIK${padSecCik(cik)}.json`;
  const fetched = await safeFetchJson(
    submissionsUrl,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": userAgent,
      },
    },
    deps,
  );
  if (!fetched.ok) {
    return {
      ok: false,
      provider: "SEC_FILINGS",
      ticker,
      payload: emptyPayload,
      errorCode: fetched.errorCode,
      statusCode: fetched.statusCode,
    };
  }

  const json = fetched.json;
  const recent = isRecord(json) && isRecord(json.filings) && isRecord(json.filings.recent)
    ? json.filings.recent
    : null;
  if (!recent) {
    return {
      ok: true,
      provider: "SEC_FILINGS",
      ticker,
      payload: emptyPayload,
    };
  }

  const forms = Array.isArray(recent.form) ? recent.form : [];
  const accessionNumbers = Array.isArray(recent.accessionNumber) ? recent.accessionNumber : [];
  const filingDates = Array.isArray(recent.filingDate) ? recent.filingDate : [];
  const descriptions = Array.isArray(recent.primaryDocDescription) ? recent.primaryDocDescription : [];

  const filings = forms.slice(0, 10).map((form, index) =>
    mapSecFilingRow(
      ticker,
      form,
      accessionNumbers[index],
      filingDates[index],
      descriptions[index],
    ),
  );

  return {
    ok: true,
    provider: "SEC_FILINGS",
    ticker,
    payload: { filings },
  };
}

const PROVIDER_FETCHERS: Record<
  MarketSignalProvider,
  (ticker: string, deps?: MarketSignalFetcherDeps) => Promise<MarketSignalFetchResult>
> = {
  POLYGON_DARK_POOL: fetchPolygonDarkPoolPayload,
  POLYGON_OPTIONS_FLOW: fetchPolygonOptionsFlowPayload,
  EODHD_INSIDER_ACTIVITY: fetchEodhdInsiderActivityPayload,
  SEC_FILINGS: fetchSecFilingsPayload,
};

function shouldEnqueueFetchedPayload(result: MarketSignalFetchResult): boolean {
  if (result.ok) return true;
  return result.errorCode === "MISSING_API_KEY" || result.errorCode === "MISSING_SEC_USER_AGENT";
}

export async function fetchProviderPayload(
  providerInput: MarketSignalProvider | string,
  tickerInput: string,
  deps?: MarketSignalFetcherDeps,
): Promise<MarketSignalFetchResult> {
  const provider = parseMarketSignalProvider(providerInput);
  const ticker = normalizeFetchTicker(tickerInput);
  if (!provider) {
    return {
      ok: false,
      provider: "POLYGON_DARK_POOL",
      ticker: ticker ?? tickerInput,
      payload: { results: [] },
      errorCode: "PROVIDER_ERROR",
    };
  }
  if (!ticker) {
    const emptyPayload =
      provider === "EODHD_INSIDER_ACTIVITY"
        ? { data: [] }
        : provider === "SEC_FILINGS"
          ? { filings: [] }
          : { results: [] };
    return invalidTickerResult(provider, tickerInput.trim().toUpperCase(), emptyPayload);
  }

  return PROVIDER_FETCHERS[provider](ticker, deps);
}

export async function fetchAndEnqueueMarketSignal(
  input: {
    provider: MarketSignalProvider | string;
    ticker: string;
    requestedByUserId?: string;
    reason?: string;
  },
  deps?: {
    fetchProviderPayload?: typeof fetchProviderPayload;
    enqueueProviderPayload?: (
      payload: Parameters<typeof enqueueProviderPayload>[0],
    ) => Promise<MarketSignalEnqueueResult>;
    fetcherDeps?: MarketSignalFetcherDeps;
  },
): Promise<MarketSignalFetchEnqueueResult> {
  const provider = parseMarketSignalProvider(input.provider);
  const ticker = normalizeFetchTicker(input.ticker);
  if (!provider) {
    return {
      queued: false,
      provider: "POLYGON_DARK_POOL",
      ticker: input.ticker,
      fetchOk: false,
      errorCode: "PROVIDER_ERROR",
    };
  }
  if (!ticker) {
    return {
      queued: false,
      provider,
      ticker: input.ticker.trim().toUpperCase(),
      fetchOk: false,
      errorCode: "INVALID_TICKER",
    };
  }

  const fetchFn = deps?.fetchProviderPayload ?? fetchProviderPayload;
  const enqueueFn = deps?.enqueueProviderPayload ?? enqueueProviderPayload;
  const fetchResult = await fetchFn(provider, ticker, deps?.fetcherDeps);

  if (!shouldEnqueueFetchedPayload(fetchResult)) {
    return {
      queued: false,
      provider,
      ticker,
      fetchOk: fetchResult.ok,
      errorCode: fetchResult.errorCode,
    };
  }

  const enqueueResult = await enqueueFn({
    provider,
    payload: fetchResult.payload,
    requestedByUserId: input.requestedByUserId,
    reason: input.reason,
  });

  return {
    queued: true,
    provider,
    ticker,
    fetchOk: fetchResult.ok,
    errorCode: fetchResult.errorCode,
    jobId: enqueueResult.jobId,
  };
}

export function sanitizeFetchErrorMessage(message: string, deps?: MarketSignalFetcherDeps): string {
  const resolved = resolveFetcherDeps(deps);
  const secrets = [
    resolved.getEnv("POLYGON_API_KEY") ?? "",
    resolved.getEnv("EODHD_API_KEY") ?? "",
  ];
  return redactSecretsFromText(message, secrets);
}

export type { MarketSignalFetchErrorCode };
