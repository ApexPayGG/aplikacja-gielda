import type { Company } from "@prisma/client";
import { prisma } from "../../db";

export type CompanyLogoLookup = {
  symbol: string;
  logoUrl: string | null;
  name: string | null;
  exchange: string | null;
};

const PREFERRED_EXCHANGES = ["US", "WAR", "XETRA", "LSE"] as const;

export function symbolBase(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  const dot = upper.indexOf(".");
  return dot > 0 ? upper.slice(0, dot) : upper;
}

function buildCandidateSymbols(ticker: string): string[] {
  const upper = ticker.trim().toUpperCase();
  if (!upper) return [];
  const base = symbolBase(upper);
  const out = new Set<string>([upper, base]);
  if (!upper.includes(".")) {
    for (const ex of PREFERRED_EXCHANGES) {
      out.add(`${base}.${ex}`);
    }
  }
  return [...out];
}

function exchangeFromCompany(company: Pick<Company, "exchange" | "description">): string | null {
  const ex = company.exchange?.trim().toUpperCase();
  if (ex && ex !== "UNKNOWN") return ex;
  const match = company.description?.match(/Exchange=([A-Z0-9_]+)/i)?.[1];
  return match ? match.toUpperCase() : ex || null;
}

function scoreCompanyMatch(company: Pick<Company, "symbol" | "logoUrl" | "exchange">, ticker: string): number {
  const upper = ticker.trim().toUpperCase();
  const base = symbolBase(upper);
  const cUpper = company.symbol.trim().toUpperCase();
  const cBase = symbolBase(cUpper);
  if (cUpper === upper) {
    return 1000 + (company.logoUrl ? 20 : 0);
  }
  if (cBase !== base) return -1;
  let score = 100 + (company.logoUrl ? 50 : 0);
  const ex = company.exchange?.trim().toUpperCase() ?? "";
  const prefIdx = PREFERRED_EXCHANGES.indexOf(ex as (typeof PREFERRED_EXCHANGES)[number]);
  if (prefIdx >= 0) score += 10 - prefIdx;
  return score;
}

export async function resolveCompanyLogosForTickers(tickers: string[]): Promise<Map<string, CompanyLogoLookup>> {
  const unique = [...new Set(tickers.map((t) => t.trim().toUpperCase()).filter(Boolean))];
  const result = new Map<string, CompanyLogoLookup>();
  if (unique.length === 0) return result;

  const candidateSet = new Set<string>();
  for (const ticker of unique) {
    for (const sym of buildCandidateSymbols(ticker)) {
      candidateSet.add(sym);
    }
  }

  const companies = await prisma.company.findMany({
    where: { symbol: { in: [...candidateSet] } },
    select: { symbol: true, name: true, logoUrl: true, exchange: true, description: true },
  });

  for (const ticker of unique) {
    const ranked = companies
      .map((company) => ({ company, score: scoreCompanyMatch(company, ticker) }))
      .filter((row) => row.score >= 0)
      .sort((a, b) => b.score - a.score);
    const best = ranked[0]?.company;
    result.set(ticker, {
      symbol: ticker,
      logoUrl: best?.logoUrl ?? null,
      name: best?.name ?? null,
      exchange: best ? exchangeFromCompany(best) : null,
    });
  }

  return result;
}
