import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { prisma } from "../db/index";
import { requireAuth } from "../modules/auth/authMiddleware";
import {
  cancelOrder,
  getAccount,
  getOrders,
  getPortfolioHistory,
  getPositions,
  placeOrder,
  type AlpacaCredentials,
  type AlpacaMode,
} from "../modules/brokers/alpacaModule";

function normalizeMode(raw: unknown): AlpacaMode {
  return String(raw ?? "").trim().toLowerCase() === "live" ? "live" : "paper";
}

function validateOrderBody(body: Record<string, unknown>): string | null {
  const symbol = String(body.symbol ?? "").trim().toUpperCase();
  const qty = Number(body.qty);
  const side = String(body.side ?? "").trim().toLowerCase();
  const type = String(body.type ?? "market").trim().toLowerCase();
  if (!symbol) return "Missing symbol";
  if (!Number.isFinite(qty) || qty <= 0) return "Invalid qty";
  if (side !== "buy" && side !== "sell") return "Invalid side";
  if (type !== "market" && type !== "limit") return "Invalid type";
  if (type === "limit") {
    const limitPrice = Number(body.limitPrice);
    if (!Number.isFinite(limitPrice) || limitPrice <= 0) return "Invalid limitPrice";
  }
  return null;
}

async function resolveCredentials(userId?: string): Promise<AlpacaCredentials | null> {
  const trimmedUserId = String(userId ?? "").trim();
  let userSettings:
    | {
        alpacaApiKey: string | null;
        alpacaApiSecret: string | null;
        alpacaMode: string | null;
        taxCountry: string | null;
      }
    | null = null;
  if (trimmedUserId) {
    userSettings = await prisma.userSettings.findUnique({
      where: { userId: trimmedUserId },
      select: { alpacaApiKey: true, alpacaApiSecret: true, alpacaMode: true, taxCountry: true },
    });
  }

  const apiKey = userSettings?.alpacaApiKey?.trim() || process.env.ALPACA_API_KEY?.trim() || "";
  const apiSecret =
    userSettings?.alpacaApiSecret?.trim() || process.env.ALPACA_API_SECRET?.trim() || "";
  const mode = normalizeMode(userSettings?.alpacaMode ?? process.env.ALPACA_MODE ?? "paper");

  if (!apiKey || !apiSecret) return null;
  return { apiKey, apiSecret, mode };
}

async function ensureAlpacaConfigured(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const userId =
      String(req.query.userId ?? "").trim() ||
      String((req.body as Record<string, unknown> | undefined)?.userId ?? "").trim();
    const credentials = await resolveCredentials(userId);
    if (!credentials) {
      res.status(503).json({ error: "Alpaca not configured" });
      return;
    }
    res.locals.alpacaCredentials = credentials;
    next();
  } catch (error) {
    next(error);
  }
}

export function createAlpacaRouter(): Router {
  const router = Router();
  router.use("/api/alpaca", requireAuth);

  router.get("/api/alpaca/settings/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      const row = await prisma.userSettings.findUnique({
        where: { userId },
        select: { alpacaApiKey: true, alpacaApiSecret: true, alpacaMode: true, taxCountry: true },
      });
      res.json({
        alpacaApiKey: row?.alpacaApiKey ?? null,
        alpacaApiSecret: row?.alpacaApiSecret ?? null,
        alpacaMode: row?.alpacaMode ? normalizeMode(row.alpacaMode) : null,
        taxCountry: row?.taxCountry ?? null,
      });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/alpaca/settings", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as Record<string, unknown>;
      const userId = String(body.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      const hasApiKey = Object.prototype.hasOwnProperty.call(body, "alpacaApiKey");
      const hasApiSecret = Object.prototype.hasOwnProperty.call(body, "alpacaApiSecret");
      const hasMode = Object.prototype.hasOwnProperty.call(body, "alpacaMode");
      const hasTaxCountry = Object.prototype.hasOwnProperty.call(body, "taxCountry");

      const alpacaApiKey = hasApiKey ? String(body.alpacaApiKey ?? "").trim() : undefined;
      const alpacaApiSecret = hasApiSecret ? String(body.alpacaApiSecret ?? "").trim() : undefined;
      const alpacaMode = hasMode ? normalizeMode(body.alpacaMode) : undefined;
      const taxCountry = hasTaxCountry ? String(body.taxCountry ?? "").trim().toUpperCase() || "PL" : undefined;
      await prisma.userSettings.upsert({
        where: { userId },
        create: {
          userId,
          alpacaApiKey: alpacaApiKey ?? "",
          alpacaApiSecret: alpacaApiSecret ?? "",
          alpacaMode: alpacaMode ?? "paper",
          taxCountry: taxCountry ?? "PL",
        },
        update: {
          ...(alpacaApiKey !== undefined ? { alpacaApiKey } : {}),
          ...(alpacaApiSecret !== undefined ? { alpacaApiSecret } : {}),
          ...(alpacaMode !== undefined ? { alpacaMode } : {}),
          ...(taxCountry !== undefined ? { taxCountry } : {}),
        },
      });
      res.json({ saved: true });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/alpaca/account", ensureAlpacaConfigured, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const credentials = res.locals.alpacaCredentials as AlpacaCredentials;
      const account = await getAccount(credentials);
      res.json({ account, mode: credentials.mode });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/alpaca/positions", ensureAlpacaConfigured, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const credentials = res.locals.alpacaCredentials as AlpacaCredentials;
      const positions = await getPositions(credentials);
      res.json({ positions });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/alpaca/orders", ensureAlpacaConfigured, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const credentials = res.locals.alpacaCredentials as AlpacaCredentials;
      const status = String(req.query.status ?? "all").trim();
      const orders = await getOrders(credentials, status);
      res.json({ orders });
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/alpaca/orders", ensureAlpacaConfigured, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as Record<string, unknown>;
      const validationError = validateOrderBody(body);
      if (validationError) return res.status(400).json({ error: validationError });

      const credentials = res.locals.alpacaCredentials as AlpacaCredentials;
      const order = await placeOrder(credentials, {
        symbol: String(body.symbol).trim().toUpperCase(),
        qty: Number(body.qty),
        side: String(body.side).trim().toLowerCase() as "buy" | "sell",
        type: String(body.type ?? "market").trim().toLowerCase() as "market" | "limit",
        timeInForce: "day",
        limitPrice:
          body.limitPrice !== undefined ? Number(body.limitPrice) : undefined,
      });
      res.json({ order });
    } catch (error) {
      next(error);
    }
  });

  router.delete(
    "/api/alpaca/orders/:orderId",
    ensureAlpacaConfigured,
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const orderId = String(req.params.orderId ?? "").trim();
        if (!orderId) return res.status(400).json({ error: "Missing orderId" });
        const credentials = res.locals.alpacaCredentials as AlpacaCredentials;
        const cancelled = await cancelOrder(credentials, orderId);
        res.json({ cancelled });
      } catch (error) {
        next(error);
      }
    },
  );

  router.get(
    "/api/alpaca/portfolio/history",
    ensureAlpacaConfigured,
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const credentials = res.locals.alpacaCredentials as AlpacaCredentials;
        const history = await getPortfolioHistory(credentials);
        res.json({ equity: history.equity, timestamps: history.timestamps });
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}

