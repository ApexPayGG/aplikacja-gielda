import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { cacheJsonGet, cacheJsonSet } from "../cache/jsonCache";
import { REDIS_TTL_SEC, redisKeys } from "../config/redis";
import { prisma } from "../db/index";

type CompanySitemapRow = {
  symbol: string;
  createdAt: Date;
};

type SitemapRouteDeps = {
  baseUrl: string;
  staticPages: string[];
  getCompanies: () => Promise<CompanySitemapRow[]>;
  cacheGet: (key: string) => Promise<string | null>;
  cacheSet: (key: string, value: string, ttlSec: number) => Promise<void>;
  cacheKey: string;
  cacheTtlSec: number;
  now: () => Date;
};

const DEFAULT_STATIC_PAGES = [
  "/",
  "/companies",
  "/signals",
  "/pricing",
  "/glossary",
  "/privacy",
  "/terms",
];

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&apos;");
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/+$/, "");
}

function joinUrl(baseUrl: string, path: string): string {
  if (path === "/") return `${baseUrl}/`;
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function buildSitemapXml(params: {
  baseUrl: string;
  staticPages: string[];
  companies: CompanySitemapRow[];
  generatedAt: Date;
}): string {
  const { baseUrl, staticPages, companies, generatedAt } = params;
  const generatedAtIso = generatedAt.toISOString();
  const staticEntries = staticPages.map((pagePath) => ({
    loc: joinUrl(baseUrl, pagePath),
    lastmod: generatedAtIso,
    changefreq: "weekly",
    priority: "0.8",
  }));
  const companyEntries = companies.map((company) => ({
    loc: joinUrl(baseUrl, `/company/${company.symbol.toUpperCase()}`),
    lastmod: company.createdAt.toISOString(),
    changefreq: "daily",
    priority: "0.6",
  }));
  const allEntries = [...staticEntries, ...companyEntries];
  const body = allEntries
    .map(
      (entry) =>
        [
          "  <url>",
          `    <loc>${escapeXml(entry.loc)}</loc>`,
          `    <lastmod>${entry.lastmod}</lastmod>`,
          `    <changefreq>${entry.changefreq}</changefreq>`,
          `    <priority>${entry.priority}</priority>`,
          "  </url>",
        ].join("\n"),
    )
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    body,
    "</urlset>",
  ].join("\n");
}

function buildRobotsTxt(baseUrl: string): string {
  return [
    "User-agent: *",
    "Allow: /",
    "Disallow: /admin",
    "Disallow: /api",
    "Disallow: /dashboard",
    "Disallow: /settings",
    `Sitemap: ${joinUrl(baseUrl, "/sitemap.xml")}`,
  ].join("\n");
}

export function createSitemapRouter(depsInput?: Partial<SitemapRouteDeps>): Router {
  const deps: SitemapRouteDeps = {
    baseUrl: normalizeBaseUrl(depsInput?.baseUrl ?? "https://stock-ai.pro"),
    staticPages: depsInput?.staticPages ?? DEFAULT_STATIC_PAGES,
    getCompanies:
      depsInput?.getCompanies ??
      (async () =>
        prisma.company.findMany({
          select: { symbol: true, createdAt: true },
          orderBy: { symbol: "asc" },
        })),
    cacheGet: depsInput?.cacheGet ?? (async (key) => cacheJsonGet<string>(key)),
    cacheSet: depsInput?.cacheSet ?? cacheJsonSet,
    cacheKey: depsInput?.cacheKey ?? redisKeys.sitemapXml(),
    cacheTtlSec: depsInput?.cacheTtlSec ?? REDIS_TTL_SEC.SITEMAP,
    now: depsInput?.now ?? (() => new Date()),
  };

  const router = Router();

  router.get("/sitemap.xml", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const cached = await deps.cacheGet(deps.cacheKey);
      if (cached !== null) {
        return res.type("application/xml").send(cached);
      }

      const companies = await deps.getCompanies();
      const sitemapXml = buildSitemapXml({
        baseUrl: deps.baseUrl,
        staticPages: deps.staticPages,
        companies,
        generatedAt: deps.now(),
      });
      await deps.cacheSet(deps.cacheKey, sitemapXml, deps.cacheTtlSec);
      return res.type("application/xml").send(sitemapXml);
    } catch (error) {
      return next(error);
    }
  });

  router.get("/robots.txt", (_req: Request, res: Response) => {
    return res.type("text/plain").send(buildRobotsTxt(deps.baseUrl));
  });

  return router;
}

