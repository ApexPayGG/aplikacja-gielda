import type { NextFunction, Request, Response } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../db/index";
import {
  ConversionImportService,
  type ConversionImportResult,
} from "../services/affiliate/ConversionImportService";

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim().toUpperCase()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(",")
      .map((v) => v.trim().toUpperCase())
      .filter(Boolean);
  }
  return [];
}

type BrokerWriteBody = Record<string, unknown>;

function toJsonField(value: unknown):
  | Prisma.InputJsonValue
  | Prisma.NullableJsonNullValueInput
  | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function parseBrokerWriteInput(body: BrokerWriteBody) {
  const slug = String(body.slug ?? "").trim().toLowerCase();
  const displayName = String(body.displayName ?? "").trim();
  const partnerId = String(body.partnerId ?? "").trim();
  const baseUrl = String(body.baseUrl ?? "").trim();
  const attributionMethod = String(body.attributionMethod ?? "").trim() || "click_id";
  const commissionModel = String(body.commissionModel ?? "").trim() || "cpa";
  if (!slug || !displayName || !partnerId || !baseUrl) {
    throw new Error("Missing required fields: slug, displayName, partnerId, baseUrl");
  }
  return {
    slug,
    displayName,
    logoUrl: String(body.logoUrl ?? "").trim() || null,
    partnerId,
    affiliateProgramUrl: String(body.affiliateProgramUrl ?? "").trim() || null,
    baseUrl,
    tickerUrlTemplate: String(body.tickerUrlTemplate ?? "").trim() || null,
    clickIdParam: String(body.clickIdParam ?? "").trim() || "cid",
    attributionMethod,
    supportedCountries: parseStringArray(body.supportedCountries),
    supportedMarkets: parseStringArray(body.supportedMarkets),
    primaryLanguage: String(body.primaryLanguage ?? "").trim() || null,
    commissionModel,
    commissionCpaAmount:
      body.commissionCpaAmount !== undefined && body.commissionCpaAmount !== null
        ? Number(body.commissionCpaAmount)
        : null,
    commissionRevsharePct:
      body.commissionRevsharePct !== undefined && body.commissionRevsharePct !== null
        ? Number(body.commissionRevsharePct)
        : null,
    commissionCurrency: String(body.commissionCurrency ?? "").trim() || "EUR",
    conversionTracking: String(body.conversionTracking ?? "").trim() || null,
    apiEndpoint: String(body.apiEndpoint ?? "").trim() || null,
    webhookSecret: String(body.webhookSecret ?? "").trim() || null,
    isActive: Boolean(body.isActive),
    priority:
      body.priority !== undefined && body.priority !== null ? Number(body.priority) : 100,
    legalDisclaimer: toJsonField(body.legalDisclaimer),
    riskWarning: toJsonField(body.riskWarning),
  };
}

export function createAdminAffiliateRouter(): Router {
  const router = Router();
  const conversionImportService = new ConversionImportService();

  router.get("/api/admin/affiliate/brokers", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const brokers = await prisma.affiliateBroker.findMany({
        orderBy: [{ priority: "asc" }, { displayName: "asc" }],
      });
      res.json({ brokers });
    } catch (error) {
      next(error);
    }
  });

  router.get(
    "/api/admin/affiliate/brokers/:slug",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const slug = String(req.params.slug ?? "").trim().toLowerCase();
        if (!slug) return res.status(400).json({ error: "Missing slug" });
        const broker = await prisma.affiliateBroker.findUnique({ where: { slug } });
        if (!broker) return res.status(404).json({ error: "Broker not found" });
        res.json({ broker });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post("/api/admin/affiliate/brokers", async (req: Request, res: Response, next: NextFunction) => {
    try {
      const input = parseBrokerWriteInput(req.body as BrokerWriteBody);
      const broker = await prisma.affiliateBroker.create({ data: input });
      res.status(201).json({ broker });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid payload";
      res.status(400).json({ error: message });
    }
  });

  router.patch(
    "/api/admin/affiliate/brokers/:slug",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const slug = String(req.params.slug ?? "").trim().toLowerCase();
        if (!slug) return res.status(400).json({ error: "Missing slug" });
        const body = req.body as BrokerWriteBody;
        const partial = {
          displayName:
            body.displayName !== undefined ? String(body.displayName).trim() : undefined,
          logoUrl: body.logoUrl !== undefined ? String(body.logoUrl).trim() || null : undefined,
          partnerId:
            body.partnerId !== undefined ? String(body.partnerId).trim() : undefined,
          affiliateProgramUrl:
            body.affiliateProgramUrl !== undefined
              ? String(body.affiliateProgramUrl).trim() || null
              : undefined,
          baseUrl: body.baseUrl !== undefined ? String(body.baseUrl).trim() : undefined,
          tickerUrlTemplate:
            body.tickerUrlTemplate !== undefined
              ? String(body.tickerUrlTemplate).trim() || null
              : undefined,
          clickIdParam:
            body.clickIdParam !== undefined ? String(body.clickIdParam).trim() || "cid" : undefined,
          attributionMethod:
            body.attributionMethod !== undefined
              ? String(body.attributionMethod).trim()
              : undefined,
          supportedCountries:
            body.supportedCountries !== undefined
              ? parseStringArray(body.supportedCountries)
              : undefined,
          supportedMarkets:
            body.supportedMarkets !== undefined ? parseStringArray(body.supportedMarkets) : undefined,
          primaryLanguage:
            body.primaryLanguage !== undefined
              ? String(body.primaryLanguage).trim() || null
              : undefined,
          commissionModel:
            body.commissionModel !== undefined ? String(body.commissionModel).trim() : undefined,
          commissionCpaAmount:
            body.commissionCpaAmount !== undefined && body.commissionCpaAmount !== null
              ? Number(body.commissionCpaAmount)
              : body.commissionCpaAmount === null
                ? null
                : undefined,
          commissionRevsharePct:
            body.commissionRevsharePct !== undefined && body.commissionRevsharePct !== null
              ? Number(body.commissionRevsharePct)
              : body.commissionRevsharePct === null
                ? null
                : undefined,
          commissionCurrency:
            body.commissionCurrency !== undefined
              ? String(body.commissionCurrency).trim() || "EUR"
              : undefined,
          conversionTracking:
            body.conversionTracking !== undefined
              ? String(body.conversionTracking).trim() || null
              : undefined,
          apiEndpoint:
            body.apiEndpoint !== undefined ? String(body.apiEndpoint).trim() || null : undefined,
          webhookSecret:
            body.webhookSecret !== undefined
              ? String(body.webhookSecret).trim() || null
              : undefined,
          isActive: body.isActive !== undefined ? Boolean(body.isActive) : undefined,
          priority:
            body.priority !== undefined && body.priority !== null ? Number(body.priority) : undefined,
          legalDisclaimer:
            body.legalDisclaimer !== undefined
              ? toJsonField(body.legalDisclaimer)
              : undefined,
          riskWarning:
            body.riskWarning !== undefined ? toJsonField(body.riskWarning) : undefined,
        };
        const broker = await prisma.affiliateBroker.update({
          where: { slug },
          data: partial,
        });
        res.json({ broker });
      } catch (error) {
        next(error);
      }
    },
  );

  router.delete(
    "/api/admin/affiliate/brokers/:slug",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const slug = String(req.params.slug ?? "").trim().toLowerCase();
        if (!slug) return res.status(400).json({ error: "Missing slug" });
        await prisma.affiliateBroker.delete({ where: { slug } });
        res.json({ deleted: true });
      } catch (error) {
        next(error);
      }
    },
  );

  router.post("/api/admin/affiliate/import-csv", async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const brokerSlug = String(body.brokerSlug ?? "").trim().toLowerCase();
      const csvContent = String(body.csvContent ?? "");
      if (!brokerSlug || !csvContent.trim()) {
        return res.status(400).json({ error: "Missing brokerSlug or csvContent" });
      }
      const result: ConversionImportResult = await conversionImportService.importFromCSV(
        brokerSlug,
        csvContent,
      );
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed";
      res.status(400).json({ error: message });
    }
  });

  router.post("/api/v1/admin/affiliate/import-csv", async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const brokerSlug = String(body.brokerSlug ?? "").trim().toLowerCase();
      const csvContent = String(body.csvContent ?? "");
      if (!brokerSlug || !csvContent.trim()) {
        return res.status(400).json({ error: "Missing brokerSlug or csvContent" });
      }
      const result: ConversionImportResult = await conversionImportService.importFromCSV(
        brokerSlug,
        csvContent,
      );
      res.json(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed";
      res.status(400).json({ error: message });
    }
  });

  const dashboardHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const periodRaw = String(req.query.period ?? "last_30d").trim().toLowerCase();
      const periodDays =
        periodRaw === "today" ? 1 : periodRaw === "last_7d" ? 7 : periodRaw === "all-time" ? null : 30;
      const since = periodDays == null ? null : new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000);
      const clickWhere = since ? { clickedAt: { gte: since } } : {};
      const convWhere = since ? { recordedAt: { gte: since } } : {};

      const [clicks, conversions, byBroker, byCountry, bySource] = await Promise.all([
        prisma.affiliateClick.count({ where: clickWhere }),
        prisma.affiliateConversion.findMany({
          where: convWhere,
          select: { conversionType: true, commissionAmount: true },
        }),
        prisma.affiliateConversion.groupBy({
          by: ["brokerId"],
          where: convWhere,
          _count: { _all: true },
          _sum: { commissionAmount: true },
        }),
        prisma.affiliateClick.groupBy({
          by: ["countryCode"],
          where: clickWhere,
          _count: { _all: true },
        }),
        prisma.affiliateClick.groupBy({
          by: ["sourcePage"],
          where: clickWhere,
          _count: { _all: true },
        }),
      ]);

      const brokerMap = new Map(
        (
          await prisma.affiliateBroker.findMany({
            select: { id: true, slug: true, displayName: true },
          })
        ).map((b) => [b.id, b]),
      );
      const totalCommission = conversions.reduce((acc, c) => acc + Number(c.commissionAmount ?? 0), 0);
      const signups = conversions.filter((c) => c.conversionType === "signup").length;
      const ftds = conversions.filter((c) => c.conversionType === "ftd").length;

      res.json({
        period: periodRaw,
        total_clicks: clicks,
        total_conversions: conversions.length,
        total_commission: Math.round(totalCommission * 100) / 100,
        conversion_rate: clicks > 0 ? Math.round((conversions.length / clicks) * 10000) / 100 : 0,
        conversion_funnel: { clicks, signups, ftds, paid: conversions.length },
        by_broker: byBroker.map((row) => ({
          broker_id: row.brokerId,
          slug: brokerMap.get(row.brokerId)?.slug ?? null,
          display_name: brokerMap.get(row.brokerId)?.displayName ?? null,
          conversions: row._count._all,
          commission: Math.round(Number(row._sum.commissionAmount ?? 0) * 100) / 100,
        })),
        by_country: byCountry.map((row) => ({ country: row.countryCode ?? "unknown", clicks: row._count._all })),
        by_source_page: bySource.map((row) => ({ page: row.sourcePage ?? "unknown", clicks: row._count._all })),
      });
    } catch (error) {
      next(error);
    }
  };

  router.get("/api/admin/affiliate/dashboard", dashboardHandler);
  router.get("/api/v1/admin/affiliate/dashboard", dashboardHandler);

  const webhookHandler = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const brokerSlug = String(req.params.brokerSlug ?? "").trim().toLowerCase();
      if (!brokerSlug) return res.status(400).json({ error: "Missing brokerSlug" });
      const broker = await prisma.affiliateBroker.findUnique({ where: { slug: brokerSlug } });
      if (!broker) return res.status(404).json({ error: "Broker not found" });

      const incomingSig = String(req.headers["x-signature"] ?? "");
      if (!broker.webhookSecret || !incomingSig) {
        return res.status(401).json({ error: "Unauthorized webhook" });
      }
      const rawPayload = JSON.stringify(req.body ?? {});
      const expected = createHmac("sha256", broker.webhookSecret).update(rawPayload).digest("hex");
      const received = incomingSig.replace(/^sha256=/i, "");
      const ok =
        expected.length === received.length &&
        timingSafeEqual(Buffer.from(expected, "utf8"), Buffer.from(received, "utf8"));
      if (!ok) return res.status(401).json({ error: "Unauthorized webhook" });

      const payload = req.body as Record<string, unknown>;
      const clickIdRef = String(payload.click_id_ref ?? payload.clickIdRef ?? payload.cid ?? "").trim() || null;
      const conversionType = String(payload.conversion_type ?? payload.conversionType ?? "ftd")
        .trim()
        .toLowerCase();
      const commissionAmount = payload.commission_amount != null ? Number(payload.commission_amount) : null;
      const commissionCurrency = String(payload.commission_currency ?? "EUR")
        .trim()
        .toUpperCase();
      const conversionDateRaw = String(payload.conversion_date ?? payload.date ?? "");
      const conversionDate = conversionDateRaw ? new Date(conversionDateRaw) : new Date();
      const matchedClick = clickIdRef
        ? await prisma.affiliateClick.findUnique({ where: { clickId: clickIdRef } })
        : null;
      await prisma.affiliateConversion.create({
        data: {
          clickIdRef,
          brokerId: broker.id,
          userId: matchedClick?.userId ?? null,
          externalUserId: String(payload.external_user_id ?? payload.user_id ?? "").trim() || null,
          conversionType,
          conversionStatus: "confirmed",
          commissionAmount: Number.isFinite(Number(commissionAmount)) ? Number(commissionAmount) : null,
          commissionCurrency: commissionCurrency || null,
          ftdAmount: payload.ftd_amount != null ? Number(payload.ftd_amount) : null,
          attributionWindowDays:
            matchedClick && Number.isFinite(conversionDate.getTime())
              ? Math.max(0, Math.floor((conversionDate.getTime() - matchedClick.clickedAt.getTime()) / (24 * 60 * 60 * 1000)))
              : null,
          matchedClickId: matchedClick?.id ?? null,
          conversionDate: Number.isFinite(conversionDate.getTime()) ? conversionDate : new Date(),
          rawBrokerData: payload,
        },
      });
      res.json({ ok: true });
    } catch (error) {
      next(error);
    }
  };

  router.post("/api/webhooks/affiliate/:brokerSlug", webhookHandler);
  router.post("/api/v1/webhooks/affiliate/:brokerSlug", webhookHandler);

  return router;
}
