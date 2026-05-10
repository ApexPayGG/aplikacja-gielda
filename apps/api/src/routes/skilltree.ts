import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import {
  checkSkillProgress,
  getSkillTree,
  type SkillId,
  type SkillTreeResponse,
} from "../modules/skilltree/skillTreeModule";

type SkillTreeRouteDeps = {
  getSkillTreeFn: (userId: string) => Promise<SkillTreeResponse>;
  checkProgressFn: (userId: string) => Promise<{ newlyUnlocked: SkillId[] }>;
};

export function createSkillTreeRouter(depsInput?: Partial<SkillTreeRouteDeps>): Router {
  const deps: SkillTreeRouteDeps = {
    getSkillTreeFn: depsInput?.getSkillTreeFn ?? getSkillTree,
    checkProgressFn: depsInput?.checkProgressFn ?? checkSkillProgress,
  };

  const router = Router();

  router.get("/api/skilltree/:userId", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.params.userId ?? "").trim();
      if (!userId) {
        return res.status(400).json({ error: "Missing userId" });
      }
      const result = await deps.getSkillTreeFn(userId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post(
    "/api/skilltree/:userId/check",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const userId = String(req.params.userId ?? "").trim();
        if (!userId) {
          return res.status(400).json({ error: "Missing userId" });
        }
        const result = await deps.checkProgressFn(userId);
        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
