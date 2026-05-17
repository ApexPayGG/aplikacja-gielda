import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { prisma } from "../db/index";
import { requireAuth } from "../modules/auth/authMiddleware";
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

  const redirectHandler = async (req: Request, res: Response, next: NextFunction) => {
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
  };

  router.get("/api/affiliate/redirect", redirectHandler);
  router.get("/api/v1/affiliate/redirect", redirectHandler);

  const clickHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const broker = String(body.broker ?? "").trim().toLowerCase();
      if (!broker) return res.status(400).json({ error: "Missing broker" });

      const sourcePage = String(body.page ?? "").trim() || "etoro_cta";
      const ticker = String(body.ticker ?? "").trim().toUpperCase() || undefined;
      const sourceSignalId = String(body.signalId ?? "").trim() || undefined;
      const userId = String(body.userId ?? "").trim() || undefined;
      const language = String(body.lang ?? "").trim() || undefined;

      const result = await clickTrackingService.trackClick({
        userId,
        brokerSlug: broker,
        language,
        ticker,
        sourcePage,
        sourceSignalId,
        request: req,
      });

      res.status(201).json({
        clickId: result.clickId,
        broker,
        lang: language ?? null,
        url: result.redirectUrl,
        countryCode: result.countryCode,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("not available")) {
        return res.status(404).json({ error: error.message });
      }
      next(error);
    }
  };

  router.post("/api/affiliate/click", clickHandler);
  router.post("/api/v1/affiliate/click", clickHandler);

  const brokersHandler = async (req: Request, res: Response, next: NextFunction) => {
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
  };

  router.get("/api/affiliate/brokers", brokersHandler);
  router.get("/api/v1/affiliate/brokers", brokersHandler);

  router.use("/api/affiliate/my-impact", requireAuth);
  router.get("/api/affiliate/my-impact", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = String(req.query.userId ?? "").trim();
      if (!userId) return res.status(400).json({ error: "Missing userId" });
      const periodDays = Math.max(1, Math.min(365, Number.parseInt(String(req.query.periodDays ?? "30"), 10) || 30));
      const since = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);

      const [clicks, conversions] = await Promise.all([
        prisma.affiliateClick.count({ where: { userId, clickedAt: { gte: since } } }),
        prisma.affiliateConversion.findMany({
          where: { userId, recordedAt: { gte: since } },
          select: { commissionAmount: true, conversionType: true },
        }),
      ]);

      const openedAccounts = conversions.filter((c) => c.conversionType === "signup" || c.conversionType === "ftd").length;
      const supportAmount = conversions.reduce((acc, c) => acc + Number(c.commissionAmount ?? 0), 0);

      res.json({
        userId,
        periodDays,
        clicks,
        openedAccounts,
        supportAmount: Math.round(supportAmount * 100) / 100,
      });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
