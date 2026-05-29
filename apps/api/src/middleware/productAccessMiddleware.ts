import type { Express, Router } from "express";
import { requireAuth } from "../modules/auth/authMiddleware";
import { requireActiveAccess } from "./requireActiveAccess";

/** Auth + active trial/subscription required for product APIs. */
export const productAccessMiddleware = [requireAuth, requireActiveAccess] as const;

/** Mount a router behind requireAuth and requireActiveAccess. */
export function useProductRouter(app: Express, router: Router): void {
  app.use(...productAccessMiddleware, router);
}
