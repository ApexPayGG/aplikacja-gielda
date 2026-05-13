import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import {
  createDecisionLog,
  createTradingRule,
  deleteTradingRule,
  getTraderProfile,
  listDecisionLogs,
  listTradingRules,
  seedDefaultTradingRules,
  updateTraderProfile,
} from "../modules/psyche/psycheProfileModule";
import { getAuthenticatedUserId, requireAuth } from "../modules/auth/authMiddleware";

export function createPsycheRouter(): Router {
  const router = Router();
  router.use(requireAuth);

  router.get("/api/psyche/profile/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthenticatedUserId(req);
      const data = await getTraderProfile(userId);
      res.json(data);
    } catch (e) {
      next(e);
    }
  });

  router.post("/api/psyche/profile/:userId/refresh", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthenticatedUserId(req);
      const profile = await updateTraderProfile(userId);
      res.json({ profile });
    } catch (e) {
      next(e);
    }
  });

  router.get("/api/psyche/rules/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthenticatedUserId(req);
      await seedDefaultTradingRules(userId);
      const rules = await listTradingRules(userId);
      res.json({ rules });
    } catch (e) {
      next(e);
    }
  });

  router.post("/api/psyche/rules/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthenticatedUserId(req);
      const body = req.body as Record<string, unknown>;
      const rule = String(body.rule ?? "").trim();
      if (!rule) return res.status(400).json({ error: "Missing rule" });
      const row = await createTradingRule(userId, rule);
      res.status(201).json({ rule: row });
    } catch (e) {
      next(e);
    }
  });

  router.delete("/api/psyche/rules/:ruleId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ruleId = String(req.params.ruleId ?? "").trim();
      const userId = getAuthenticatedUserId(req);
      if (!ruleId) return res.status(400).json({ error: "Missing ruleId" });
      const deleted = await deleteTradingRule(userId, ruleId);
      res.json({ deleted });
    } catch (e) {
      next(e);
    }
  });

  router.post("/api/psyche/decision-log", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as Record<string, unknown>;
      const userId = getAuthenticatedUserId(req);
      const symbol = String(body.symbol ?? "").trim();
      const action = String(body.action ?? "").trim();
      if (!symbol) return res.status(400).json({ error: "Missing symbol" });
      if (!action) return res.status(400).json({ error: "Missing action" });

      const tradeId = body.tradeId != null && body.tradeId !== "" ? String(body.tradeId) : null;
      const mood = body.mood != null ? String(body.mood) : null;
      const reasoning = body.reasoning != null ? String(body.reasoning) : null;
      const planCompliance =
        body.planCompliance === undefined || body.planCompliance === null ? null : Boolean(body.planCompliance);
      const outcome =
        body.outcome === undefined || body.outcome === null ? null : Number(body.outcome);

      const log = await createDecisionLog({
        userId,
        symbol,
        action,
        mood,
        reasoning,
        tradeId,
        planCompliance,
        outcome: outcome != null && Number.isFinite(outcome) ? outcome : null,
      });
      res.status(201).json({ log });
    } catch (e) {
      next(e);
    }
  });

  router.get("/api/psyche/decision-log/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthenticatedUserId(req);
      const take = Math.min(100, Math.max(1, parseInt(String(req.query.take ?? "50"), 10) || 50));
      const logs = await listDecisionLogs(userId, take);
      res.json({ logs });
    } catch (e) {
      next(e);
    }
  });

  return router;
}
