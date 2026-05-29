import type { Express, NextFunction, Request, RequestHandler, Response, Router } from "express";
import { requireAuth } from "../modules/auth/authMiddleware";
import { requireActiveAccess } from "./requireActiveAccess";

/** Auth + active trial/subscription required for product APIs. */
export const productAccessMiddleware = [requireAuth, requireActiveAccess] as const;

/** Public /api routes registered after the product gate (no product access required). */
const PUBLIC_API_EXACT = new Set([
  "/api/redis/stats",
  "/api/companies/search",
  "/api/companies/search/import",
]);

const PUBLIC_API_PREFIXES = [
  "/api/quotes",
  "/api/companies/logos",
  "/api/companies/sector/",
  "/api/affiliate/redirect",
  "/api/v1/affiliate/redirect",
  "/api/affiliate/click",
  "/api/v1/affiliate/click",
  "/api/affiliate/brokers",
  "/api/v1/affiliate/brokers",
  "/api/admin",
  "/api/v1/admin",
  "/api/sitemap",
  "/api/brief",
  "/api/analysis",
  "/api/news/",
  "/api/indicators/",
  "/api/test/",
] as const;

const COMPANY_DETAIL = /^\/api\/companies\/[^/]+$/;
const COMPANY_BRIEF = /^\/api\/companies\/[^/]+\/brief$/;

export function isPublicApiPath(path: string): boolean {
  if (PUBLIC_API_EXACT.has(path)) return true;
  if (PUBLIC_API_PREFIXES.some((prefix) => path === prefix || path.startsWith(prefix))) return true;
  if (COMPANY_DETAIL.test(path) || COMPANY_BRIEF.test(path)) return true;
  return false;
}

/** Applies product access only to /api/* routes that are not on the public allowlist. */
export const requireProductAccessForApi: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const path = req.path;
  if (!path.startsWith("/api/")) {
    next();
    return;
  }
  if (isPublicApiPath(path)) {
    next();
    return;
  }
  requireAuth(req, res, () => {
    void requireActiveAccess(req, res, next);
  });
};

/** Mount a product router without app-level auth (use requireProductAccessForApi once before all product routers). */
export function useProductRouter(app: Express, router: Router): void {
  app.use(router);
}
