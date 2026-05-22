import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { prisma } from "../db/index";
import { getLatestQuote } from "../db/queries";
import { resolveCompanyLogosForTickers, symbolBase } from "../modules/companies/companyLogoLookup";

function quoteCandidates(ticker: string): string[] {
  const upper = ticker.trim().toUpperCase();
  const base = symbolBase(upper);
  const out = new Set<string>([upper]);
  if (!upper.includes(".")) out.add(`${base}.US`);
  out.add(base);
  return [...out];
}

async function latestQuoteForTicker(ticker: string): Promise<{ price: number; changePct: number } | null> {
  for (const sym of quoteCandidates(ticker)) {
    const row = await getLatestQuote(sym);
    if (!row) continue;
    const close = Number(row.close);
    const open = Number(row.open);
    if (!Number.isFinite(close)) continue;
    const changePct =
      Number.isFinite(open) && open !== 0 ? ((close - open) / open) * 100 : 0;
    return { price: close, changePct };
  }
  return null;
}

export function createSignalsListRouter(): Router {
  const router = Router();

  router.get("/api/signals", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
      const now = new Date();

      const rows = await prisma.signal.findMany({
        where: { expires_at: { gt: now } },
        orderBy: { created_at: "desc" },
        take: limit,
      });

      const tickers = rows.map((row) => row.ticker.trim().toUpperCase()).filter(Boolean);
      const logoMap = await resolveCompanyLogosForTickers(tickers);

      const signals = await Promise.all(
        rows.map(async (row) => {
          const ticker = row.ticker.trim().toUpperCase();
          const meta = logoMap.get(ticker);
          const quote = await latestQuoteForTicker(ticker);
          return {
            id: row.id,
            ticker,
            symbol: ticker,
            companyName: meta?.name ?? ticker,
            logoUrl: meta?.logoUrl ?? null,
            setupType: row.pattern_type,
            riskScore: row.score ?? row.confidence,
            exchange: row.exchange || meta?.exchange || null,
            createdAt: row.created_at.toISOString(),
            changePct: quote?.changePct ?? 0,
            price: quote?.price ?? 0,
          };
        }),
      );

      res.json({ signals, count: signals.length });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
