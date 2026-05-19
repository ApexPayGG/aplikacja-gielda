import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { getLossStreakCoolDown } from "../modules/behavioral/lossStreakCoolDown";
import { analyzeMistakesForUser, getMistakeLibrary } from "../modules/behavioral/mistakeLibrary";
import {
  createEmotionJournalEntry,
  createPsycheSnapshot,
  getLatestPsycheSnapshot,
  listEmotionJournalEntries,
  listPsycheSnapshotHistory,
  parseApiEmotion,
} from "../modules/behavioral/behavioralPersistence";
import { getAuthenticatedUserId, requireAuth } from "../modules/auth/authMiddleware";

function parseLimit(raw: unknown, fallback = 20): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(100, Math.floor(n));
}

function parseDays(raw: unknown, fallback = 30): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(365, Math.floor(n));
}

function assertSelfAccess(req: Request, requestedUserId: string): void {
  const authUserId = getAuthenticatedUserId(req);
  if (requestedUserId !== authUserId) {
    const err = new Error("Forbidden");
    (err as Error & { statusCode?: number }).statusCode = 403;
    throw err;
  }
}

export function createBehavioralRouter(): Router {
  const router = Router();
  router.use("/api/behavioral", requireAuth);

  router.get("/api/behavioral/cooldown/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthenticatedUserId(req);
      const status = await getLossStreakCoolDown(userId);
      res.json(status);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/behavioral/mistakes/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthenticatedUserId(req);
      const data = await getMistakeLibrary(userId);
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/behavioral/mistakes/:userId/analyze", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = getAuthenticatedUserId(req);
      const result = await analyzeMistakesForUser(userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/behavioral/emotion", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUserId = getAuthenticatedUserId(req);
      const body = req.body as { userId?: string; emotion?: string; ticker?: string; note?: string };
      const userId = String(body.userId ?? authUserId).trim();
      assertSelfAccess(req, userId);

      const emotion = parseApiEmotion(body.emotion);
      const entry = await createEmotionJournalEntry({
        userId,
        emotion,
        ticker: body.ticker,
        note: body.note,
      });

      console.info(
        JSON.stringify({
          level: "info",
          event: "behavioral_emotion_saved",
          userId,
          provider: "timescaledb",
          emotion,
        }),
      );

      res.status(201).json({
        id: entry.id,
        userId: entry.userId,
        emotion: entry.emotion,
        ticker: entry.ticker,
        note: entry.note,
        createdAt: entry.createdAt.toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/behavioral/emotions/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      assertSelfAccess(req, userId);
      const limit = parseLimit(req.query.limit, 20);
      const rows = await listEmotionJournalEntries(userId, limit);
      res.json(
        rows.map((row) => ({
          id: row.id,
          userId: row.userId,
          emotion: row.emotion,
          ticker: row.ticker,
          note: row.note,
          createdAt: row.createdAt.toISOString(),
        })),
      );
    } catch (error) {
      next(error);
    }
  });

  router.post("/api/behavioral/psyche-snapshot", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const authUserId = getAuthenticatedUserId(req);
      const body = req.body as {
        userId?: string;
        fomoScore?: number;
        discipline?: number;
        greedControl?: number;
        patience?: number;
        growthScore?: number;
      };
      const userId = String(body.userId ?? authUserId).trim();
      assertSelfAccess(req, userId);

      const snapshot = await createPsycheSnapshot(userId, body);
      console.info(
        JSON.stringify({
          level: "info",
          event: "behavioral_psyche_snapshot_saved",
          userId,
          provider: "timescaledb",
          snapshotId: snapshot.id,
        }),
      );

      res.status(201).json({
        id: snapshot.id,
        userId: snapshot.userId,
        fomoScore: snapshot.fomoScore,
        discipline: snapshot.discipline,
        greedControl: snapshot.greedControl,
        patience: snapshot.patience,
        growthScore: snapshot.growthScore,
        createdAt: snapshot.createdAt.toISOString(),
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/behavioral/psyche-latest/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      assertSelfAccess(req, userId);
      const latest = await getLatestPsycheSnapshot(userId);
      res.json(latest);
    } catch (error) {
      next(error);
    }
  });

  router.get("/api/behavioral/psyche-history/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      assertSelfAccess(req, userId);
      const days = parseDays(req.query.days, 30);
      const history = await listPsycheSnapshotHistory(userId, days);
      res.json({ userId, days, history });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
