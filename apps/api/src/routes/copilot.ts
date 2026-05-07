import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import pino from "pino";
import { prisma } from "../db/index";
import { getCacheRedis } from "../redis";

interface ParsedIntent {
  market: string[];
  pattern: string;
  filters: {
    sector?: string;
    dy_min?: number;
    dy_max?: number;
    payout_ratio_max?: number;
    trend?: "rising" | "stable" | "falling";
    market_cap_min?: number;
    years_of_dividend?: number;
  };
  timeframe?: string;
  additional_context?: string;
}

type RedisRateStore = Pick<ReturnType<typeof getCacheRedis>, "incr" | "expire" | "ttl">;

type CopilotRouteDeps = {
  parseIntentFn: (query: string) => Promise<ParsedIntent>;
  generateSQLFn: (intent: ParsedIntent) => Promise<{ query: string; params: any[] }>;
  runQueryFn: (query: string, params: any[]) => Promise<unknown[]>;
  rateStore: RedisRateStore;
  getClientIp: (req: Request) => string;
};

const COPILOT_RATE_LIMIT = 10;
const COPILOT_RATE_WINDOW_SEC = 60;

const copilotLogger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { scope: "copilot_route" },
});

async function defaultParseIntent(query: string): Promise<ParsedIntent> {
  const module = (await import("../../../../packages/ai/src/copilot/intent-parser")) as {
    parseIntent?: (q: string) => Promise<ParsedIntent>;
  };
  if (!module.parseIntent) throw new Error("Intent parser is unavailable");
  return module.parseIntent(query);
}

async function defaultGenerateSQL(intent: ParsedIntent): Promise<{ query: string; params: any[] }> {
  const module = (await import("../../../../packages/ai/src/copilot/sql-generator")) as {
    generateSQL?: (i: ParsedIntent) => { query: string; params: any[] };
  };
  if (!module.generateSQL) throw new Error("SQL generator is unavailable");
  return module.generateSQL(intent);
}

function defaultClientIp(req: Request): string {
  return req.ip || req.socket.remoteAddress || "unknown";
}

function toPostgresPlaceholders(queryWithQuestionMarks: string): string {
  let idx = 0;
  return queryWithQuestionMarks.replace(/\?/g, () => {
    idx += 1;
    return `$${idx}`;
  });
}

async function applyRateLimit(rateStore: RedisRateStore, key: string): Promise<{ ok: boolean; retryAfterSec?: number }> {
  const count = await rateStore.incr(key);
  if (count === 1) {
    await rateStore.expire(key, COPILOT_RATE_WINDOW_SEC);
  }
  if (count > COPILOT_RATE_LIMIT) {
    const ttl = await rateStore.ttl(key);
    return { ok: false, retryAfterSec: Math.max(1, ttl) };
  }
  return { ok: true };
}

export function createCopilotRouter(depsInput?: Partial<CopilotRouteDeps>): Router {
  const deps: CopilotRouteDeps = {
    parseIntentFn: depsInput?.parseIntentFn ?? defaultParseIntent,
    generateSQLFn: depsInput?.generateSQLFn ?? defaultGenerateSQL,
    runQueryFn:
      depsInput?.runQueryFn ??
      (async (query: string, params: any[]) => {
        const pgQuery = toPostgresPlaceholders(query);
        return prisma.$queryRawUnsafe(pgQuery, ...params);
      }),
    rateStore: depsInput?.rateStore ?? getCacheRedis(),
    getClientIp: depsInput?.getClientIp ?? defaultClientIp,
  };

  const router = Router();

  router.post("/api/copilot/query", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as { query?: unknown; language?: unknown };
      const query = String(body.query ?? "").trim();
      const language = body.language === "en" ? "en" : "pl";
      const ip = deps.getClientIp(req);

      // MVP auth skip: we only log caller IP.
      copilotLogger.info({ msg: "copilot_request", ip, language });

      const rl = await applyRateLimit(deps.rateStore, `rate:copilot:${ip}`);
      if (!rl.ok) {
        res.setHeader("Retry-After", String(rl.retryAfterSec ?? COPILOT_RATE_WINDOW_SEC));
        res.status(429).json({ error: "Rate limit exceeded. Try again later." });
        return;
      }

      if (!query) {
        res.status(400).json({ error: "Missing query in request body" });
        return;
      }

      let intent: ParsedIntent;
      try {
        intent = await deps.parseIntentFn(query);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        res.status(400).json({
          error: "Intent parse failed",
          details: msg,
          suggestion:
            language === "pl"
              ? "Spróbuj doprecyzować zapytanie, np. 'breakout na GPW, DY > 4%'."
              : "Try a clearer query, e.g. 'breakout on NYSE, dividend yield above 4%'.",
        });
        return;
      }

      let built: { query: string; params: any[] };
      try {
        built = await deps.generateSQLFn(intent);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        if (msg.includes("Invalid exchange")) {
          res.status(400).json({ error: msg });
          return;
        }
        throw error;
      }

      try {
        const results = await deps.runQueryFn(built.query, built.params);
        res.json({
          intent,
          results,
          count: results.length,
          message:
            language === "pl"
              ? `Znaleziono ${results.length} wyników pasujących do intencji.`
              : `Found ${results.length} results matching your intent.`,
        });
      } catch (error) {
        copilotLogger.error({
          msg: "copilot_db_query_failed",
          ip,
          err: error instanceof Error ? error.message : String(error),
        });
        res.status(500).json({ error: "Database query failed" });
      }
    } catch (error) {
      next(error);
    }
  });

  return router;
}

