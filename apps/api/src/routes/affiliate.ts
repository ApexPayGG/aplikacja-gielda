import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { prisma } from "../db/index";
import { ClickTrackingService } from "../services/affiliate/ClickTrackingService";
import { extractClientIp, getCountryFromIp } from "../services/affiliate/geoIpService";

function marketEligible(supportedMarkets: string[], market?: string): boolean {
  if (!market || !market.trim()) return true;
  if (supportedMarkets.length === 0) return true;
  return supportedMarkets.includes(market.trim().toUpperCase());
}

function countryEligible(supportedCountries: string[], country?: string | null): boolean {
  if (!country || !country.trim()) return true;
  if (supportedCountries.length === 0) return true;
  return supportedCountries.includes(country.trim().toUpperCase());
}

export function createAffiliateRouter(): Router {
  const router = Router();
  const clickTrackingService = new ClickTrackingService();

  router.get("/api/affiliate/redirect", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const broker = String(req.query.broker ?? "").trim().toLowerCase();
      if (!broker) return res.status(400).json({ error: "Missing broker" });

      const sourcePage = String(req.query.page ?? "").trim();
      if (!sourcePage) return res.status(400).json({ error: "Missing page" });

      const ticker = String(req.query.ticker ?? "").trim().toUpperCase() || undefined;
      const sourceSignalId = String(req.query.signal ?? "").trim() || undefined;
      const userId = String(req.query.userId ?? "").trim() || undefined;

      const result = await clickTrackingService.trackClick({
        userId,
        brokerSlug: broker,
        ticker,
        sourcePage,
        sourceSignalId,
        request: req,
      });

      res.redirect(302, result.redirectUrl);
    } catch (error) {
      if (error instanceof Error && error.message.includes("not available")) {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  });

  router.get("/api/affiliate/brokers", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const market = String(req.query.market ?? "").trim().toUpperCase() || undefined;
      let country = String(req.query.country ?? "").trim().toUpperCase() || null;

      if (!country) {
        const ip = extractClientIp({
          forwardedFor: req.headers["x-forwarded-for"],
          realIp: typeof req.headers["x-real-ip"] === "string" ? req.headers["x-real-ip"] : undefined,
          reqIp: req.ip,
          remoteAddress: req.socket.remoteAddress,
        });
        country = await getCountryFromIp(ip);
      }

      const rows = await prisma.affiliateBroker.findMany({
        where: { isActive: true },
        orderBy: [{ priority: "asc" }, { displayName: "asc" }],
      });
      const brokers = rows
        .filter((row) => countryEligible(row.supportedCountries, country))
        .filter((row) => marketEligible(row.supportedMarkets, market))
        .map((row) => ({
          slug: row.slug,
          displayName: row.displayName,
          logoUrl: row.logoUrl,
          supportedMarkets: row.supportedMarkets,
          legalDisclaimer: row.legalDisclaimer,
          riskWarning: row.riskWarning,
          priority: row.priority,
        }));

      const defaultBroker = brokers[0] ?? null;
      res.json({ country, market: market ?? null, defaultBroker, brokers });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
