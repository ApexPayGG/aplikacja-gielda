import { Prisma } from "@prisma/client";
import type { Fundamental, News, Quote, TechnicalIndicator } from "@prisma/client";
import { prisma } from "./index";

export type QuoteInsertData = {
  timestamp: Date;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: bigint | number;
  source: string;
};

export type NewsInsertData = {
  timestamp: Date;
  title: string;
  url: string;
  sentiment?: string | null;
  source: string;
};

export async function insertQuote(symbol: string, data: QuoteInsertData): Promise<Quote> {
  return prisma.quote.create({
    data: {
      symbol: symbol.toUpperCase(),
      timestamp: data.timestamp,
      open: new Prisma.Decimal(data.open),
      high: new Prisma.Decimal(data.high),
      low: new Prisma.Decimal(data.low),
      close: new Prisma.Decimal(data.close),
      volume: BigInt(data.volume),
      source: data.source,
    },
  });
}

export async function insertNews(symbol: string, data: NewsInsertData): Promise<News> {
  return prisma.news.create({
    data: {
      symbol: symbol.toUpperCase(),
      timestamp: data.timestamp,
      title: data.title,
      url: data.url,
      sentiment: data.sentiment ?? null,
      source: data.source,
    },
  });
}

export async function insertIndicator(
  symbol: string,
  indicator: string,
  value: number,
): Promise<TechnicalIndicator> {
  return prisma.technicalIndicator.create({
    data: {
      symbol: symbol.toUpperCase(),
      timestamp: new Date(),
      indicator,
      value: new Prisma.Decimal(value),
    },
  });
}

export async function insertFundamental(
  symbol: string,
  metric: string,
  value: number,
): Promise<Fundamental> {
  const sym = symbol.toUpperCase();
  const now = new Date();
  return prisma.fundamental.upsert({
    where: {
      symbol_metric: { symbol: sym, metric },
    },
    create: {
      symbol: sym,
      metric,
      value: new Prisma.Decimal(value),
      lastUpdated: now,
    },
    update: {
      value: new Prisma.Decimal(value),
      lastUpdated: now,
    },
  });
}

export async function getLatestQuote(symbol: string): Promise<Quote | null> {
  return prisma.quote.findFirst({
    where: { symbol: symbol.toUpperCase() },
    orderBy: { timestamp: "desc" },
  });
}

export async function getQuoteHistory(symbol: string, days: number): Promise<Quote[]> {
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - Math.max(1, Math.floor(days)));
  return prisma.quote.findMany({
    where: {
      symbol: symbol.toUpperCase(),
      timestamp: { gte: since },
    },
    orderBy: { timestamp: "asc" },
  });
}

export async function getRecentNews(symbol: string, limit: number): Promise<News[]> {
  return prisma.news.findMany({
    where: { symbol: symbol.toUpperCase() },
    orderBy: { timestamp: "desc" },
    take: limit,
  });
}

export async function getLatestIndicator(
  symbol: string,
  indicator: string,
): Promise<TechnicalIndicator | null> {
  return prisma.technicalIndicator.findFirst({
    where: {
      symbol: symbol.toUpperCase(),
      indicator,
    },
    orderBy: { timestamp: "desc" },
  });
}
