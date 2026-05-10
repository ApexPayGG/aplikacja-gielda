import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { generateMentorGuidance } from "../modules/mentor/mentorModule";

type MentorRequestBody = {
  ticker?: unknown;
  setupType?: unknown;
  riskScore?: unknown;
  marketRegime?: unknown;
  mentorStyle?: unknown;
  lang?: unknown;
};

export function createMentorRouter(): Router {
  const router = Router();

  router.post("/api/mentor/guidance", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.body ?? {}) as MentorRequestBody;
      const ticker = String(body.ticker ?? "").trim().toUpperCase();
      const setupType = String(body.setupType ?? "").trim();
      if (!ticker || !setupType) {
        return res.status(400).json({ error: "Missing ticker or setupType" });
      }

      const result = await generateMentorGuidance({
        ticker,
        setupType,
        riskScore: Number(body.riskScore ?? 0) || 0,
        marketRegime: String(body.marketRegime ?? "RANGING").trim().toUpperCase(),
        mentorStyle: String(body.mentorStyle ?? "supportive") === "strict" ? "strict" : "supportive",
        lang: String(body.lang ?? "en").trim() || "en",
      });

      return res.json(result);
    } catch (error) {
      return next(error);
    }
  });

  return router;
}
