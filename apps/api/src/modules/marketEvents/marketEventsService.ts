import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../db/index";
import { marketEventsSyncHorizonDays } from "./config";
import { daysUntilEventDate } from "./dedupe";
import { fetchNormalizedMarketEventsFromEodhd } from "./providers/eodhdCalendarProvider";
import type {
  EventImportance,
  MarketEventType,
  NormalizedMarketEvent,
  WatchlistDailyDigest,
  WatchlistDigestItem,
} from "./types";
import { IMPORTANCE_RANK, meetsMinImportance } from "./types";

function addDaysIso(isoDate: string, days: number): string {
  const d = new Date(`${isoDate.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function upsertMarketEvents(
  events: NormalizedMarketEvent[],
  db: PrismaClient = defaultPrisma,
): Promise<{ upserted: number }> {
  let upserted = 0;
  for (const e of events) {
    await db.marketEvent.upsert({
      where: { dedupeKey: e.dedupeKey },
      create: {
        symbol: e.symbol,
        exchange: e.exchange ?? null,
        eventType: e.eventType,
        eventSubtype: e.eventSubtype ?? null,
        eventDate: new Date(`${e.eventDate}T00:00:00.000Z`),
        eventTime: e.eventTime ?? null,
        importance: e.importance,
        title: e.title,
        summary: e.summary ?? null,
        source: e.source,
        sourceUrl: e.sourceUrl ?? null,
        dedupeKey: e.dedupeKey,
        payload: e.payload ?? undefined,
        fiscalPeriod: e.fiscalPeriod ?? null,
      },
      update: {
        importance: e.importance,
        title: e.title,
        summary: e.summary ?? null,
        eventTime: e.eventTime ?? null,
        payload: e.payload ?? undefined,
        updatedAt: new Date(),
      },
    });
    upserted += 1;
  }
  return { upserted };
}

export async function syncMarketEventsFromProviders(
  db: PrismaClient = defaultPrisma,
): Promise<{ upserted: number; sources: string[] }> {
  const from = todayIso();
  const to = addDaysIso(from, marketEventsSyncHorizonDays());
  const sources: string[] = [];

  let events: NormalizedMarketEvent[] = [];
  if (process.env.EODHD_API_KEY?.trim()) {
    events = await fetchNormalizedMarketEventsFromEodhd(from, to);
    sources.push("eodhd");
  }

  const filtered = filterEventsForWatchlistSymbols(events, await collectTrackedSymbols(db));
  const { upserted } = await upsertMarketEvents(filtered, db);
  return { upserted, sources };
}

async function collectTrackedSymbols(db: PrismaClient): Promise<Set<string>> {
  const [watchlist, companies] = await Promise.all([
    db.watchlist.findMany({ select: { symbol: true }, distinct: ["symbol"] }),
    db.company.findMany({ select: { symbol: true }, take: 500, orderBy: { symbol: "asc" } }),
  ]);
  const set = new Set<string>();
  for (const row of watchlist) set.add(row.symbol.trim().toUpperCase());
  for (const row of companies) set.add(row.symbol.trim().toUpperCase());
  return set;
}

/** Keep macro + events for symbols users track or top universe. */
export function filterEventsForWatchlistSymbols(
  events: NormalizedMarketEvent[],
  tracked: Set<string>,
): NormalizedMarketEvent[] {
  if (tracked.size === 0) return events;
  return events.filter((e) => {
    if (!e.symbol) return true;
    const sym = e.symbol.trim().toUpperCase();
    if (tracked.has(sym)) return true;
    const base = sym.split(".")[0] ?? sym;
    for (const t of tracked) {
      if (t.startsWith(`${base}.`) || t === base) return true;
    }
    return false;
  });
}

export type ListMarketEventsQuery = {
  from?: string;
  to?: string;
  symbol?: string;
  eventType?: MarketEventType;
  importance?: EventImportance;
  limit?: number;
};

export async function listMarketEvents(
  query: ListMarketEventsQuery,
  db: PrismaClient = defaultPrisma,
) {
  const from = query.from ?? todayIso();
  const to = query.to ?? addDaysIso(from, marketEventsSyncHorizonDays());
  const limit = Math.min(200, Math.max(1, query.limit ?? 50));

  const rows = await db.marketEvent.findMany({
    where: {
      eventDate: {
        gte: new Date(`${from}T00:00:00.000Z`),
        lte: new Date(`${to}T23:59:59.999Z`),
      },
      ...(query.symbol ? { symbol: query.symbol.trim().toUpperCase() } : {}),
      ...(query.eventType ? { eventType: query.eventType } : {}),
      ...(query.importance ? { importance: query.importance } : {}),
    },
    orderBy: [{ importance: "desc" }, { eventDate: "asc" }],
    take: limit,
  });

  return rows.map((row) => ({
    ...row,
    eventDate: row.eventDate.toISOString().slice(0, 10),
    daysToEvent: daysUntilEventDate(row.eventDate.toISOString().slice(0, 10)),
  }));
}

export async function listWatchlistMarketEvents(
  userId: string,
  query: Omit<ListMarketEventsQuery, "symbol">,
  db: PrismaClient = defaultPrisma,
) {
  const watchlist = await db.watchlist.findMany({
    where: { userId },
    select: { symbol: true },
  });
  const symbols = watchlist.map((w) => w.symbol.trim().toUpperCase());
  if (symbols.length === 0) {
    return { symbols: [], events: [] as Awaited<ReturnType<typeof listMarketEvents>> };
  }

  const from = query.from ?? todayIso();
  const to = query.to ?? addDaysIso(from, marketEventsSyncHorizonDays());
  const limit = Math.min(100, Math.max(1, query.limit ?? 40));

  const rows = await db.marketEvent.findMany({
    where: {
      symbol: { in: symbols },
      eventDate: {
        gte: new Date(`${from}T00:00:00.000Z`),
        lte: new Date(`${to}T23:59:59.999Z`),
      },
      ...(query.eventType ? { eventType: query.eventType } : {}),
      ...(query.importance ? { importance: query.importance } : {}),
    },
    orderBy: [{ importance: "desc" }, { eventDate: "asc" }],
    take: limit,
  });

  const events = rows.map((row) => ({
    ...row,
    eventDate: row.eventDate.toISOString().slice(0, 10),
    daysToEvent: daysUntilEventDate(row.eventDate.toISOString().slice(0, 10)),
  }));

  return { symbols, events };
}

export async function buildWatchlistDailyDigest(
  userId: string,
  db: PrismaClient = defaultPrisma,
): Promise<WatchlistDailyDigest> {
  const { symbols, events } = await listWatchlistMarketEvents(userId, {
    from: todayIso(),
    to: addDaysIso(todayIso(), 14),
    limit: 80,
  });

  const items: WatchlistDigestItem[] = events.map((e) => ({
    symbol: e.symbol,
    eventType: e.eventType as MarketEventType,
    eventDate: e.eventDate,
    importance: e.importance as EventImportance,
    title: e.title,
    summary: e.summary,
    daysToEvent: e.daysToEvent,
  }));

  const highRiskSymbols = [
    ...new Set(
      items
        .filter((i) => meetsMinImportance(i.importance, "high") && i.symbol)
        .sort((a, b) => a.daysToEvent - b.daysToEvent)
        .slice(0, 5)
        .map((i) => i.symbol as string),
    ),
  ];

  const macroHighlights = items.filter((i) => !i.symbol || i.eventType === "macro");

  const earningsCount = items.filter((i) => i.eventType === "earnings" && i.daysToEvent <= 7).length;
  const dividendCount = items.filter((i) => i.eventType === "dividend" && i.daysToEvent <= 7).length;

  const headline =
    symbols.length === 0
      ? "Dodaj spółki do watchlisty, aby otrzymywać Event Risk Radar."
      : `Dzisiaj ${items.length} wydarzeń na watchliście: ${earningsCount} wyników (7 dni), ${dividendCount} dywidend.`;

  return {
    date: todayIso(),
    headline,
    items: items.slice(0, 25),
    highRiskSymbols,
    macroHighlights: macroHighlights.slice(0, 5),
  };
}

export function defaultEventSubscription(userId: string) {
  return {
    userId,
    watchlistOnly: true,
    eventTypes: ["earnings", "dividend", "macro"],
    channels: ["in_app"],
    minImportance: "medium",
    daysBefore: [7, 3, 1, 0],
    isActive: true,
  };
}

export async function upsertDefaultSubscription(userId: string, db: PrismaClient = defaultPrisma) {
  const existing = await db.eventSubscription.findFirst({
    where: { userId, isActive: true },
  });
  if (existing) return existing;
  return db.eventSubscription.create({ data: defaultEventSubscription(userId) });
}

export function rankImportance(a: string, b: string): number {
  const ra = IMPORTANCE_RANK[a as EventImportance] ?? 0;
  const rb = IMPORTANCE_RANK[b as EventImportance] ?? 0;
  return rb - ra;
}

/** Anchor row for digest delivery logs (no FK orphan). */
export async function ensureSystemAnchorEvent(db: PrismaClient = defaultPrisma) {
  return db.marketEvent.upsert({
    where: { dedupeKey: "system:event_risk_radar" },
    create: {
      symbol: null,
      eventType: "macro",
      eventSubtype: "system",
      eventDate: new Date(`${todayIso()}T00:00:00.000Z`),
      importance: "low",
      title: "Event Risk Radar",
      summary: "System anchor for digest deliveries",
      source: "system",
      dedupeKey: "system:event_risk_radar",
    },
    update: { updatedAt: new Date() },
  });
}
