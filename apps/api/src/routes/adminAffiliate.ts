import type { NextFunction, Request, Response } from "express";
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

  return router;
}
