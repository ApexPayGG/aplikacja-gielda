import {
  createTimeoutSignal,
  DEFAULT_FETCH_TIMEOUT_MS,
  normalizeFetchTicker,
  redactSecretsFromText,
  redactUrl,
} from "./marketSignals.fetchers";
import type {
  MarketSignalsEodhdProviderCheck,
  MarketSignalsPolygonProviderCheck,
  MarketSignalsProviderCheckResponse,
  MarketSignalsSecProviderCheck,
  ProviderCheckEndpointResult,
  ProviderCheckEntitledEndpointResult,
  ProviderCheckErrorCode,
  ProviderCheckProvider,
} from "./marketSignals.types";

const POLYGON_BASE = "https://api.polygon.io";
const EODHD_INSIDER_BASE = "https://eodhd.com/api/insider-transactions";
const SEC_COMPANY_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const SEC_SUBMISSIONS_BASE = "https://data.sec.gov/submissions";

export type EnvGetter = (key: string) => string | undefined;

export type ProviderCheckDeps = {
  fetchFn?: typeof fetch;
  getEnv?: EnvGetter;
  now?: () => Date;
  timeoutMs?: number;
};

type FetchStatusResult = {
  httpStatus: number | null;
  ok: boolean;
  errorCode?: ProviderCheckErrorCode;
  bodyText?: string;
};

function defaultGetEnv(key: string): string | undefined {
  return process.env[key]?.trim() || undefined;
}

function isEnvConfigured(getEnv: EnvGetter, key: string): boolean {
  const value = getEnv(key);
  return value !== undefined && value.length > 0;
}

function resolveEodhdInsiderCode(ticker: string): string {
  return ticker.includes(".") ? ticker : `${ticker}.US`;
}

function padSecCik(cik: number): string {
  return String(cik).padStart(10, "0");
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

export function parseProviderCheckProvider(raw: unknown): ProviderCheckProvider | null {
  const normalized = String(raw ?? "").trim().toUpperCase();
  if (normalized === "" || normalized === "ALL") return "ALL";
  if (normalized === "POLYGON" || normalized === "EODHD" || normalized === "SEC") {
    return normalized;
  }
  return null;
}

function missingApiKeyEndpoint(): ProviderCheckEndpointResult {
  return {
    checked: false,
    httpStatus: null,
    ok: false,
    errorCode: "MISSING_API_KEY",
  };
}

function missingApiKeyEntitledEndpoint(): ProviderCheckEntitledEndpointResult {
  return {
    checked: false,
    httpStatus: null,
    ok: false,
    entitled: false,
    errorCode: "MISSING_API_KEY",
  };
}

function toEndpointCheck(result: FetchStatusResult, checked = true): ProviderCheckEndpointResult {
  return {
    checked,
    httpStatus: result.httpStatus,
    ok: result.ok,
    errorCode: result.errorCode,
  };
}

function toEntitledEndpoint(result: FetchStatusResult, checked = true): ProviderCheckEntitledEndpointResult {
  return {
    checked,
    httpStatus: result.httpStatus,
    ok: result.ok,
    entitled: result.ok && result.httpStatus === 200,
    errorCode: result.errorCode,
  };
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  deps: Required<Pick<ProviderCheckDeps, "fetchFn" | "timeoutMs">>,
  secrets: string[] = [],
): Promise<FetchStatusResult> {
  const timeout = createTimeoutSignal(deps.timeoutMs);
  try {
    const response = await deps.fetchFn(url, {
      ...init,
      signal: timeout.signal,
    });
    const bodyText = await response.text();
    const status = response.status;

    if (status === 401) {
      return { httpStatus: 401, ok: false, errorCode: "HTTP_401", bodyText };
    }
    if (status === 403) {
      return { httpStatus: 403, ok: false, errorCode: "HTTP_403", bodyText };
    }
    if (!response.ok) {
      return { httpStatus: status, ok: false, errorCode: "HTTP_ERROR", bodyText };
    }
    return { httpStatus: status, ok: true, bodyText };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { httpStatus: null, ok: false, errorCode: "TIMEOUT" };
    }
    void redactSecretsFromText(error instanceof Error ? error.message : String(error), secrets);
    return { httpStatus: null, ok: false, errorCode: "NETWORK_ERROR" };
  } finally {
    timeout.cleanup();
  }
}

function resolveDeps(depsInput?: ProviderCheckDeps): Required<Pick<ProviderCheckDeps, "fetchFn" | "getEnv" | "now" | "timeoutMs">> {
  return {
    fetchFn: depsInput?.fetchFn ?? fetch,
    getEnv: depsInput?.getEnv ?? defaultGetEnv,
    now: depsInput?.now ?? (() => new Date()),
    timeoutMs: depsInput?.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS,
  };
}

async function resolveSecCik(
  ticker: string,
  deps: ReturnType<typeof resolveDeps>,
  userAgent: string,
): Promise<number | null> {
  const fetched = await fetchWithTimeout(
    SEC_COMPANY_TICKERS_URL,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": userAgent,
      },
    },
    deps,
  );
  if (!fetched.ok || !fetched.bodyText) return null;

  try {
    const json = JSON.parse(fetched.bodyText) as unknown;
    if (!isRecord(json)) return null;
    for (const value of Object.values(json)) {
      if (!isRecord(value)) continue;
      const entryTicker = String(value.ticker ?? "").trim().toUpperCase();
      const cik = toNumber(value.cik_str ?? value.cik);
      if (entryTicker === ticker && cik != null) {
        return Math.trunc(cik);
      }
    }
  } catch {
    return null;
  }
  return null;
}

export async function checkPolygonProvider(
  ticker: string,
  depsInput?: ProviderCheckDeps,
): Promise<MarketSignalsPolygonProviderCheck> {
  const deps = resolveDeps(depsInput);
  const apiKey = deps.getEnv("POLYGON_API_KEY");
  const apiKeyConfigured = isEnvConfigured(deps.getEnv, "POLYGON_API_KEY");

  if (!apiKey) {
    return {
      apiKeyConfigured,
      referenceTicker: missingApiKeyEndpoint(),
      tradesEndpoint: missingApiKeyEntitledEndpoint(),
      optionsSnapshotEndpoint: missingApiKeyEntitledEndpoint(),
      usableForMarketSignals: false,
    };
  }

  const secrets = [apiKey];
  const referenceUrl = `${POLYGON_BASE}/v3/reference/tickers/${encodeURIComponent(ticker)}?apiKey=${encodeURIComponent(apiKey)}`;
  const tradesUrl = `${POLYGON_BASE}/v3/trades/${encodeURIComponent(ticker)}?limit=1&order=desc&sort=timestamp&apiKey=${encodeURIComponent(apiKey)}`;
  const optionsUrl = `${POLYGON_BASE}/v3/snapshot/options/${encodeURIComponent(ticker)}?limit=1&apiKey=${encodeURIComponent(apiKey)}`;

  const [referenceResult, tradesResult, optionsResult] = await Promise.all([
    fetchWithTimeout(referenceUrl, { headers: { Accept: "application/json" } }, deps, secrets),
    fetchWithTimeout(tradesUrl, { headers: { Accept: "application/json" } }, deps, secrets),
    fetchWithTimeout(optionsUrl, { headers: { Accept: "application/json" } }, deps, secrets),
  ]);

  void redactUrl(referenceUrl, secrets);
  void redactUrl(tradesUrl, secrets);
  void redactUrl(optionsUrl, secrets);

  const tradesEndpoint = toEntitledEndpoint(tradesResult);
  const optionsSnapshotEndpoint = toEntitledEndpoint(optionsResult);

  return {
    apiKeyConfigured,
    referenceTicker: toEndpointCheck(referenceResult),
    tradesEndpoint,
    optionsSnapshotEndpoint,
    usableForMarketSignals: tradesEndpoint.entitled || optionsSnapshotEndpoint.entitled,
  };
}

export async function checkEodhdProvider(
  ticker: string,
  depsInput?: ProviderCheckDeps,
): Promise<MarketSignalsEodhdProviderCheck> {
  const deps = resolveDeps(depsInput);
  const apiKey = deps.getEnv("EODHD_API_KEY");
  const apiKeyConfigured = isEnvConfigured(deps.getEnv, "EODHD_API_KEY");

  if (!apiKey) {
    return {
      apiKeyConfigured,
      insiderActivityEndpoint: {
        ...missingApiKeyEndpoint(),
        hasData: null,
      },
      usableForMarketSignals: false,
    };
  }

  const code = resolveEodhdInsiderCode(ticker);
  const params = new URLSearchParams({
    code,
    api_token: apiKey,
    fmt: "json",
  });
  const url = `${EODHD_INSIDER_BASE}?${params.toString()}`;
  const result = await fetchWithTimeout(url, { headers: { Accept: "application/json" } }, deps, [apiKey]);
  void redactUrl(url, [apiKey]);

  let hasData: boolean | null = null;
  if (result.ok && result.bodyText != null) {
    try {
      const parsed = JSON.parse(result.bodyText) as unknown;
      hasData = Array.isArray(parsed) ? parsed.length > 0 : false;
    } catch {
      hasData = false;
    }
  }

  return {
    apiKeyConfigured,
    insiderActivityEndpoint: {
      ...toEndpointCheck(result),
      hasData,
      sizeBytes: result.bodyText != null ? result.bodyText.length : undefined,
    },
    usableForMarketSignals: result.ok && result.httpStatus === 200,
  };
}

export async function checkSecProvider(
  ticker: string,
  depsInput?: ProviderCheckDeps,
): Promise<MarketSignalsSecProviderCheck> {
  const deps = resolveDeps(depsInput);
  const userAgent = deps.getEnv("SEC_USER_AGENT");
  const userAgentConfigured = isEnvConfigured(deps.getEnv, "SEC_USER_AGENT");

  if (!userAgent) {
    return {
      userAgentConfigured,
      submissionsEndpoint: {
        checked: false,
        httpStatus: null,
        ok: false,
      },
      usableForMarketSignals: false,
    };
  }

  const cik = await resolveSecCik(ticker, deps, userAgent);
  if (cik == null) {
    return {
      userAgentConfigured,
      submissionsEndpoint: {
        checked: true,
        httpStatus: null,
        ok: false,
        errorCode: "HTTP_ERROR",
      },
      usableForMarketSignals: false,
    };
  }

  const submissionsUrl = `${SEC_SUBMISSIONS_BASE}/CIK${padSecCik(cik)}.json`;
  const result = await fetchWithTimeout(
    submissionsUrl,
    {
      headers: {
        Accept: "application/json",
        "User-Agent": userAgent,
      },
    },
    deps,
  );

  const submissionsEndpoint = toEndpointCheck(result);
  return {
    userAgentConfigured,
    submissionsEndpoint,
    usableForMarketSignals: userAgentConfigured && submissionsEndpoint.ok,
  };
}

export function buildProviderCheckWarnings(input: {
  checks: MarketSignalsProviderCheckResponse["checks"];
}): string[] {
  const warnings: string[] = [];
  const polygon = input.checks.polygon;

  if (polygon) {
    if (!polygon.apiKeyConfigured) {
      warnings.push("POLYGON_API_KEY is missing or empty.");
    } else if (
      polygon.referenceTicker.errorCode === "HTTP_401" ||
      polygon.tradesEndpoint.errorCode === "HTTP_401" ||
      polygon.optionsSnapshotEndpoint.errorCode === "HTTP_401"
    ) {
      warnings.push("POLYGON_API_KEY appears invalid (HTTP 401).");
    } else if (!polygon.usableForMarketSignals && polygon.apiKeyConfigured) {
      warnings.push("Polygon API key is valid but not entitled to MarketSignals endpoints.");
    }
  }

  const eodhd = input.checks.eodhd;
  if (eodhd && !eodhd.apiKeyConfigured) {
    warnings.push("EODHD_API_KEY is missing or empty.");
  }

  const sec = input.checks.sec;
  if (sec && !sec.userAgentConfigured) {
    warnings.push("SEC_USER_AGENT is missing; SEC fetcher is disabled.");
  }

  return warnings;
}

export async function buildMarketSignalsProviderCheck(input: {
  provider: ProviderCheckProvider;
  ticker: string;
  deps?: ProviderCheckDeps;
}): Promise<MarketSignalsProviderCheckResponse> {
  const deps = resolveDeps(input.deps);
  const normalizedTicker = normalizeFetchTicker(input.ticker) ?? "AAPL";
  const checks: MarketSignalsProviderCheckResponse["checks"] = {};

  const runPolygon = input.provider === "ALL" || input.provider === "POLYGON";
  const runEodhd = input.provider === "ALL" || input.provider === "EODHD";
  const runSec = input.provider === "ALL" || input.provider === "SEC";

  if (runPolygon) {
    checks.polygon = await checkPolygonProvider(normalizedTicker, input.deps);
  }
  if (runEodhd) {
    checks.eodhd = await checkEodhdProvider(normalizedTicker, input.deps);
  }
  if (runSec) {
    checks.sec = await checkSecProvider(normalizedTicker, input.deps);
  }

  const warnings = buildProviderCheckWarnings({ checks });

  return {
    ok: true,
    generatedAt: deps.now().toISOString(),
    ticker: normalizedTicker,
    checks,
    warnings,
  };
}
