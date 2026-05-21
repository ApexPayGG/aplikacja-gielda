import type { MarketEventType } from "./types";

function normSymbol(symbol: string | null | undefined): string {
  return (symbol ?? "").trim().toUpperCase() || "MACRO";
}

/** Stable dedupe keys — prevents duplicate alerts from multiple providers. */
export function buildEarningsDedupeKey(
  symbol: string,
  eventDate: string,
  fiscalPeriod?: string | null,
  subtype = "upcoming",
): string {
  const sym = normSymbol(symbol);
  const period = (fiscalPeriod ?? "na").trim().toLowerCase().replace(/\s+/g, "_");
  return `${sym}:earnings:${period}:${eventDate}:${subtype}`;
}

export function buildDividendDedupeKey(
  symbol: string,
  exDividendDate: string,
  paymentDate?: string | null,
): string {
  const sym = normSymbol(symbol);
  const pay = (paymentDate ?? "na").slice(0, 10);
  return `${sym}:dividend:${exDividendDate}:${pay}`;
}

export function buildCorporateActionDedupeKey(
  symbol: string,
  actionType: string,
  eventDate: string,
): string {
  return `${normSymbol(symbol)}:${actionType}:${eventDate}`;
}

export function buildMacroDedupeKey(
  eventType: MarketEventType,
  eventDate: string,
  titleSlug: string,
): string {
  const slug = titleSlug.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 64);
  return `macro:${eventType}:${eventDate}:${slug}`;
}

export function daysUntilEventDate(eventDateIso: string, now = new Date()): number {
  const target = new Date(`${eventDateIso.slice(0, 10)}T12:00:00Z`);
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12));
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

export function earningsImportanceForDays(daysToEvent: number): "low" | "medium" | "high" | "critical" {
  if (daysToEvent <= 0) return "critical";
  if (daysToEvent <= 1) return "high";
  if (daysToEvent <= 3) return "high";
  if (daysToEvent <= 7) return "medium";
  return "low";
}

export function dividendImportanceForDays(daysToEx: number): "low" | "medium" | "high" | "critical" {
  if (daysToEx <= 0) return "high";
  if (daysToEx <= 1) return "high";
  if (daysToEx <= 3) return "medium";
  return "low";
}
