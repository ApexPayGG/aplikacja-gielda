import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../db";
import { parseEodhdLogoUrlExchange, type CompanyLogoRow } from "./companyLogoBackfill";
import { parseSymbolParts } from "./companySearchModule";

const DAX_XETRA_LOGO_EXCHANGES = new Set(["DAX", "XETRA"]);

export type LogoAuditClassification = "ok" | "suspicious" | "externalProvider";

export type SuggestedLogoAction = "keep" | "review" | "clear";

export type CompanyLogoAuditEntry = {
  symbol: string;
  name: string;
  exchange: string;
  logoUrl: string;
  urlExchange: string | null;
  classification: LogoAuditClassification;
  reason: string;
  suggestedAction: SuggestedLogoAction;
};

export type CompanyLogoAuditSummary = {
  scanned: number;
  ok: number;
  suspicious: number;
  externalProvider: number;
};

export type CompanyLogoAuditResult = {
  summary: CompanyLogoAuditSummary;
  entries: CompanyLogoAuditEntry[];
};

export type CompanyLogoAuditOptions = {
  limit?: number;
  symbols?: string[];
  onlySuspicious?: boolean;
};

export type CompanyLogoAuditDeps = {
  db: {
    company: {
      findMany: PrismaClient["company"]["findMany"];
    };
  };
};

function exchangeForCompany(row: CompanyLogoRow): string {
  const fromSymbol = parseSymbolParts(row.symbol).exchange;
  if (fromSymbol) return fromSymbol;
  const ex = row.exchange?.trim().toUpperCase();
  return ex && ex !== "UNKNOWN" ? ex : "US";
}

export function isFinnhubLogoUrl(logoUrl: string): boolean {
  return /finnhub\.io/i.test(logoUrl);
}

export function areCompanyLogoExchangesCompatible(companyExchange: string, urlExchange: string): boolean {
  const companyEx = companyExchange.trim().toUpperCase();
  const urlEx = urlExchange.trim().toUpperCase();
  if (companyEx === urlEx) return true;
  return DAX_XETRA_LOGO_EXCHANGES.has(companyEx) && DAX_XETRA_LOGO_EXCHANGES.has(urlEx);
}

export function auditCompanyLogoRow(row: CompanyLogoRow): CompanyLogoAuditEntry {
  const logoUrl = row.logoUrl?.trim() ?? "";
  const companyEx = exchangeForCompany(row);
  const base = {
    symbol: row.symbol,
    name: row.name,
    exchange: companyEx,
    logoUrl,
    urlExchange: null as string | null,
  };

  if (!logoUrl) {
    return {
      ...base,
      classification: "ok",
      reason: "empty logo URL",
      suggestedAction: "keep",
    };
  }

  if (isFinnhubLogoUrl(logoUrl)) {
    return {
      ...base,
      classification: "externalProvider",
      reason: "Finnhub/static logo URL without EODHD exchange path (neutral)",
      suggestedAction: "keep",
    };
  }

  const urlExchange = parseEodhdLogoUrlExchange(logoUrl);
  if (!urlExchange) {
    return {
      ...base,
      classification: "ok",
      reason: "non-EODHD logo URL or no /img/logos/{EXCHANGE}/ segment",
      suggestedAction: "keep",
    };
  }

  if (areCompanyLogoExchangesCompatible(companyEx, urlExchange)) {
    return {
      ...base,
      urlExchange,
      classification: "ok",
      reason: `EODHD URL exchange ${urlExchange} matches listing ${companyEx}`,
      suggestedAction: "keep",
    };
  }

  return {
    ...base,
    urlExchange,
    classification: "suspicious",
    reason: `EODHD URL exchange ${urlExchange} does not match company exchange ${companyEx}`,
    suggestedAction: "clear",
  };
}

export function auditCompanyLogoRows(
  rows: CompanyLogoRow[],
  options: { onlySuspicious?: boolean } = {},
): CompanyLogoAuditResult {
  const entries = rows.map(auditCompanyLogoRow);
  const filtered = options.onlySuspicious
    ? entries.filter((entry) => entry.classification === "suspicious")
    : entries;

  const summary: CompanyLogoAuditSummary = {
    scanned: rows.length,
    ok: entries.filter((e) => e.classification === "ok").length,
    suspicious: entries.filter((e) => e.classification === "suspicious").length,
    externalProvider: entries.filter((e) => e.classification === "externalProvider").length,
  };

  return { summary, entries: filtered };
}

export async function runCompanyLogoAudit(
  options: CompanyLogoAuditOptions = {},
  deps: CompanyLogoAuditDeps = { db: defaultPrisma },
): Promise<CompanyLogoAuditResult> {
  const limit = Math.max(1, Math.min(50_000, options.limit ?? 500));
  const symbols = options.symbols?.map((s) => s.trim().toUpperCase()).filter(Boolean);

  const rows = await deps.db.company.findMany({
    where: {
      logoUrl: { not: null },
      ...(symbols?.length ? { symbol: { in: symbols } } : {}),
    },
    select: { symbol: true, name: true, exchange: true, logoUrl: true },
    orderBy: { symbol: "asc" },
    take: limit,
  });

  const companyRows: CompanyLogoRow[] = rows.map((row) => ({
    symbol: row.symbol,
    name: row.name,
    exchange: row.exchange,
    logoUrl: row.logoUrl,
  }));

  return auditCompanyLogoRows(companyRows, { onlySuspicious: options.onlySuspicious });
}

export function formatCompanyLogoAuditText(result: CompanyLogoAuditResult): string {
  const lines: string[] = [
    `scanned: ${result.summary.scanned}`,
    `ok: ${result.summary.ok}`,
    `suspicious: ${result.summary.suspicious}`,
    `externalProvider: ${result.summary.externalProvider}`,
    "",
  ];

  for (const entry of result.entries) {
    lines.push(
      [
        `symbol: ${entry.symbol}`,
        `name: ${entry.name}`,
        `exchange: ${entry.exchange}`,
        `logoUrl: ${entry.logoUrl}`,
        `urlExchange: ${entry.urlExchange ?? "(null)"}`,
        `classification: ${entry.classification}`,
        `reason: ${entry.reason}`,
        `suggestedAction: ${entry.suggestedAction}`,
      ].join("\n"),
    );
    lines.push("");
  }

  return lines.join("\n").trimEnd();
}

export function formatCompanyLogoAuditJson(result: CompanyLogoAuditResult): string {
  return JSON.stringify(result, null, 2);
}
