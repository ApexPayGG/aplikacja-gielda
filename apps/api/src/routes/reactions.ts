import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import {
  createSignalReaction,
  createTradeReaction,
  listSignalReactions,
  listTradeReactions,
} from "../modules/reactions/tradeReactionsModule";

function clientErrorStatus(message: string): 400 | 404 | null {
  if (message.includes("not found")) return 404;
  if (
    message.includes("required") ||
    message.includes("at most") ||
    message.includes("must include")
  ) {
    return 400;
  }
  return null;
}

export function createReactionsRouter(): Router {
  const router = Router();

  router.post("/api/reactions/trade", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as { userId?: unknown; tradeId?: unknown; content?: unknown };
      const userId = String(body?.userId ?? "").trim();
      const tradeId = String(body?.tradeId ?? "").trim();
      const content = String(body?.content ?? "");
      if (!userId || !tradeId) {
        return res.status(400).json({ error: "Body must include { userId, tradeId, content }" });
      }
      const reaction = await createTradeReaction({ userId, tradeId, content });
      res.status(201).json({
        reaction: {
          id: reaction.id,
          userId: reaction.userId,
          tradeId: reaction.tradeId,
          signalId: reaction.signalId,
          content: reaction.content,
          createdAt: reaction.createdAt.toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        const st = clientErrorStatus(error.message);
        if (st) return res.status(st).json({ error: error.message });
      }
      next(error);
    }
  });

  router.post("/api/reactions/signal", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = req.body as { userId?: unknown; signalId?: unknown; content?: unknown };
      const userId = String(body?.userId ?? "").trim();
      const signalId = String(body?.signalId ?? "").trim();
      const content = String(body?.content ?? "");
      if (!userId || !signalId) {
        return res.status(400).json({ error: "Body must include { userId, signalId, content }" });
      }
      const reaction = await createSignalReaction({ userId, signalId, content });
      res.status(201).json({
        reaction: {
          id: reaction.id,
          userId: reaction.userId,
          tradeId: reaction.tradeId,
          signalId: reaction.signalId,
          content: reaction.content,
          createdAt: reaction.createdAt.toISOString(),
        },
      });
    } catch (error) {
      if (error instanceof Error) {
        const st = clientErrorStatus(error.message);
        if (st) return res.status(st).json({ error: error.message });
      }
      next(error);
    }
  });

  router.get("/api/reactions/trade/:tradeId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const tradeId = String(req.params.tradeId ?? "").trim();
      if (!tradeId) return res.status(400).json({ error: "Missing tradeId" });
      const reactions = await listTradeReactions(tradeId);
      res.json({ reactions });
    } catch (error) {
      if (error instanceof Error) {
        const st = clientErrorStatus(error.message);
        if (st) return res.status(st).json({ error: error.message });
      }
      next(error);
    }
  });

  router.get("/api/reactions/signal/:signalId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const signalId = String(req.params.signalId ?? "").trim();
      if (!signalId) return res.status(400).json({ error: "Missing signalId" });
      const reactions = await listSignalReactions(signalId);
      res.json({ reactions });
    } catch (error) {
      if (error instanceof Error) {
        const st = clientErrorStatus(error.message);
        if (st) return res.status(st).json({ error: error.message });
      }
      next(error);
    }
  });

  return router;
}
