import { randomUUID } from "node:crypto";

const POLYGON_BASE = "https://api.polygon.io";

/** Duck-typed with `pino` — no hard dependency so the package resolves from apps/api only. */
export type PolygonLogger = {
  info: (meta: Record<string, unknown>, msg?: string) => void;
  warn: (meta: Record<string, unknown>, msg?: string) => void;
  error: (meta: Record<string, unknown>, msg?: string) => void;
  child: (bindings: Record<string, unknown>) => PolygonLogger;
};

function createDefaultLogger(base: Record<string, unknown> = {}): PolygonLogger {
  const write = (level: "log" | "warn" | "error", meta: Record<string, unknown>, msg?: string) => {
    const line = JSON.stringify({ level, ...base, ...meta, msg });
    if (level === "error") console.error(line);
    else if (level === "warn") console.warn(line);
    else console.log(line);
  };
  return {
    info: (m, msg) => write("log", m, msg),
    warn: (m, msg) => write("warn", m, msg),
    error: (m, msg) => write("error", m, msg),
    child: (b) => createDefaultLogger({ ...base, ...b }),
  };
}

export type PolygonQuoteRow = {
  ticker: string;
  price: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: bigint;
  vwap?: number;
  /** ISO timestamp of Polygon trade / bar end when known */
  asOf?: string;
};

type CircuitState = "closed" | "open" | "half_open";

export type PolygonClientOptions = {
  apiKey?: string;
  fetchFn?: typeof fetch;
  logger?: PolygonLogger;
  /** Consecutive failures before opening circuit */
  circuitFailureThreshold?: number;
  circuitOpenMs?: number;
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

export class PolygonClient {
  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly log: PolygonLogger;
  private readonly circuitFailureThreshold: number;
  private readonly circuitOpenMs: number;

  private circuitState: CircuitState = "closed";
  private consecutiveFailures = 0;
  private circuitOpenedAt = 0;

  constructor(opts: PolygonClientOptions = {}) {
    const key = opts.apiKey ?? process.env.POLYGON_API_KEY ?? "";
    if (!key) {
      throw new Error("POLYGON_API_KEY is not set");
    }
    this.apiKey = key;
    this.fetchImpl = opts.fetchFn ?? fetch;
    this.log = opts.logger ?? createDefaultLogger({ scope: "polygon_client" });
    this.circuitFailureThreshold = opts.circuitFailureThreshold ?? 5;
    this.circuitOpenMs = opts.circuitOpenMs ?? 60_000;
  }

  private async beforeRequest(traceId: string): Promise<void> {
    if (this.circuitState === "open") {
      const elapsed = Date.now() - this.circuitOpenedAt;
      if (elapsed >= this.circuitOpenMs) {
        this.circuitState = "half_open";
        this.log.info({ traceId, circuit: "half_open" }, "polygon circuit half-open");
      } else {
        throw new Error(`Polygon circuit open; retry after ${this.circuitOpenMs - elapsed}ms`);
      }
    }
  }

  private onSuccess(traceId: string): void {
    this.consecutiveFailures = 0;
    if (this.circuitState === "half_open") {
      this.circuitState = "closed";
      this.log.info({ traceId, circuit: "closed" }, "polygon circuit closed after success");
    }
  }

  private onFailure(traceId: string, err: unknown, retryable: boolean): void {
    if (!retryable) return;
    this.consecutiveFailures += 1;
    if (this.consecutiveFailures >= this.circuitFailureThreshold) {
      this.circuitState = "open";
      this.circuitOpenedAt = Date.now();
      this.log.error(
        { traceId, err, circuit: "open", failures: this.consecutiveFailures },
        "polygon circuit opened",
      );
    }
  }

  private async fetchJson<T>(path: string, traceId: string): Promise<T> {
    await this.beforeRequest(traceId);
    const url = `${POLYGON_BASE}${path}${path.includes("?") ? "&" : "?"}apiKey=${encodeURIComponent(this.apiKey)}`;
    let lastErr: unknown;
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const res = await this.fetchImpl(url, { headers: { Accept: "application/json" } });
        if (res.status === 429 || res.status >= 500) {
          const body = await res.text().catch(() => "");
          lastErr = new Error(`Polygon HTTP ${res.status}: ${body.slice(0, 200)}`);
          if (attempt < 3) {
            const backoff = 400 * 2 ** (attempt - 1) + Math.floor(Math.random() * 200);
            this.log.warn({ traceId, attempt, status: res.status, backoff }, "polygon retry");
            await sleep(backoff);
            continue;
          }
          this.onFailure(traceId, lastErr, true);
          throw lastErr;
        }
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          const err = new Error(`Polygon HTTP ${res.status}: ${body.slice(0, 200)}`);
          this.onFailure(traceId, err, isRetryableStatus(res.status));
          throw err;
        }
        this.onSuccess(traceId);
        return (await res.json()) as T;
      } catch (e) {
        lastErr = e;
        if (attempt < 3 && (e instanceof TypeError || (e instanceof Error && e.message.includes("fetch")))) {
          await sleep(300 * attempt);
          continue;
        }
        if (attempt === 3) {
          this.onFailure(traceId, e, true);
          throw e;
        }
      }
    }
    this.onFailure(traceId, lastErr, true);
    throw lastErr;
  }

  /**
   * Active US stock tickers (reference), sorted by ticker ascending.
   */
  async getTopStocks(limit: number = 100, traceId?: string): Promise<string[]> {
    const tid = traceId ?? randomUUID();
    const cap = Math.min(1000, Math.max(1, limit));
    const path = `/v3/reference/tickers?market=stocks&active=true&order=asc&sort=ticker&limit=${cap}`;
    const json = await this.fetchJson<{
      results?: Array<{ ticker?: string }>;
    }>(path, tid);

    const out = (json.results ?? []).map((r) => r.ticker).filter((t): t is string => Boolean(t));
    this.log.info({ traceId: tid, count: out.length }, "polygon top tickers loaded");
    return out.slice(0, cap);
  }

  /**
   * Latest quote snapshot: prefers last 5-minute aggregate bar (OHLCVW), falls back to last trade + optional day snapshot.
   */
  async getLatestQuote(ticker: string, traceId?: string): Promise<PolygonQuoteRow> {
    const tid = traceId ?? randomUUID();
    const sym = ticker.replace(/^\s+|\s+$/g, "").toUpperCase();
    if (!sym) throw new Error("ticker required");

    const now = Date.now();
    const from = now - 48 * 60 * 60 * 1000;
    const to = now;

    type AggResp = {
      results?: Array<{
        o: number;
        h: number;
        l: number;
        c: number;
        v: number;
        vw?: number;
        t: number;
      }>;
    };

    const aggPath = `/v2/aggs/ticker/${encodeURIComponent(sym)}/range/5/minute/${from}/${to}?adjusted=true&sort=desc&limit=5`;
    try {
      const agg = await this.fetchJson<AggResp>(aggPath, tid);
      const bar = agg.results?.[0];
      if (bar) {
        return {
          ticker: sym,
          price: bar.c,
          open: bar.o,
          high: bar.h,
          low: bar.l,
          close: bar.c,
          volume: BigInt(Math.round(bar.v)),
          vwap: bar.vw,
          asOf: new Date(bar.t).toISOString(),
        };
      }
    } catch (e) {
      this.log.warn({ traceId: tid, ticker: sym, err: e }, "polygon 5m agg fallback");
    }

    type LastTrade = {
      results?: { p?: number; s?: number; t?: number; x?: number };
    };
    const ltPath = `/v2/last/trade/${encodeURIComponent(sym)}`;
    const lt = await this.fetchJson<LastTrade>(ltPath, tid);
    const p = lt.results?.p;
    if (typeof p !== "number" || !Number.isFinite(p)) {
      throw new Error(`Polygon: no price for ${sym}`);
    }
    const vol = lt.results?.s != null ? BigInt(Math.round(lt.results.s)) : undefined;
    const asOf = lt.results?.t != null ? new Date(lt.results.t).toISOString() : undefined;

    return {
      ticker: sym,
      price: p,
      volume: vol,
      asOf,
    };
  }
}
