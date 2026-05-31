import type { Dividend } from "@prisma/client";
import { prisma } from "../db/index";

export type DividendDataStatus = "confirmed" | "estimated" | "stale" | "missing";

export interface DividendCalendarEvent {
  symbol: string;
  exDate: string;
  payDate: string | null;
  amount: number | null;
  currency: string;
  yield: number | null;
  frequency: string | null;
  source: string;
  dataStatus: DividendDataStatus;
}

export interface DividendCalendarQuery {
  from: Date;
  to: Date;
  symbols?: string[];
  limit: number;
}

const STALE_SYNC_MS = 180 * 24 * 60 * 60 * 1000;

export function parseIsoDateParam(value: unknown, fallback: Date): Date {
  const raw = String(value ?? "").trim();
  if (!raw) return fallback;
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) ? parsed : fallback;
}

export function parseCalendarSymbols(value: unknown): string[] | undefined {
  const raw = String(value ?? "").trim();
  if (!raw) return undefined;
  const symbols = raw
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => /^[A-Z0-9.\-]{1,12}$/.test(s));
  if (symbols.length === 0) return undefined;
  return [...new Set(symbols)].slice(0, 50);
}

export function parseCalendarLimit(value: unknown): number {
  const n = parseInt(String(value ?? "100"), 10);
  if (!Number.isFinite(n) || n < 1) return 100;
  return Math.min(500, n);
}

export function normalizeFrequencyToken(value: string | null | undefined): string | null {
  if (!value || !value.trim()) return null;
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

export function resolveDividendDataStatus(row: Pick<Dividend, "exDate" | "payDate" | "amount" | "source" | "createdAt">): DividendDataStatus {
  if (!row.exDate || !Number.isFinite(row.amount) || row.amount <= 0) return "missing";
  const source = String(row.source ?? "").toLowerCase();
  if (source === "mock_seed") return "estimated";
  const payMs = row.payDate?.getTime() ?? 0;
  const exMs = row.exDate.getTime();
  if (!Number.isFinite(payMs) || payMs <= 0 || Math.abs(payMs - exMs) < 60_000) return "estimated";
  const ageMs = Date.now() - row.createdAt.getTime();
  if (ageMs > STALE_SYNC_MS && row.exDate.getTime() < Date.now()) return "stale";
  return "confirmed";
}

export function serializeCalendarEvent(row: Dividend): DividendCalendarEvent {
  const dataStatus = resolveDividendDataStatus(row);
  return {
    symbol: row.symbol,
    exDate: row.exDate.toISOString(),
    payDate: row.payDate ? row.payDate.toISOString() : null,
    amount: Number.isFinite(row.amount) ? row.amount : null,
    currency: row.currency,
    yield: row.yield ?? null,
    frequency: row.frequency ?? null,
    source: row.source,
    dataStatus,
  };
}

export async function getDividendCalendar(query: DividendCalendarQuery): Promise<{
  events: DividendCalendarEvent[];
  count: number;
  from: string;
  to: string;
}> {
  const { from, to, symbols, limit } = query;
  const where: {
    exDate: { gte: Date; lte: Date };
    symbol?: { in: string[] };
  } = {
    exDate: { gte: from, lte: to },
  };
  if (symbols?.length) {
    where.symbol = { in: symbols };
  }

  const rows = await prisma.dividend.findMany({
    where,
    orderBy: [{ exDate: "asc" }, { symbol: "asc" }],
    take: limit,
  });

  const events = rows.map(serializeCalendarEvent);
  return {
    events,
    count: events.length,
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
}
