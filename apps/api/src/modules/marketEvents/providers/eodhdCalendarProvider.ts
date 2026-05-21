import {
  buildDividendDedupeKey,
  buildEarningsDedupeKey,
  daysUntilEventDate,
  dividendImportanceForDays,
  earningsImportanceForDays,
} from "../dedupe";
import type { NormalizedMarketEvent } from "../types";

type EodhdEarningsRow = Record<string, unknown>;
export type EodhdDividendHistoryRow = Record<string, unknown>;

function parseDateOnly(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

export function normalizeEodhdSymbol(code: unknown): string | null {
  const raw = String(code ?? "").trim().toUpperCase();
  if (!raw) return null;
  if (raw.includes(".")) return raw;
  return `${raw}.US`;
}

export function marketEventsDividendSymbolLimit(): number {
  const raw = Number(process.env.MARKET_EVENTS_DIVIDEND_SYMBOL_LIMIT ?? 200);
  if (!Number.isFinite(raw)) return 200;
  return Math.min(Math.max(Math.floor(raw), 1), 500);
}

export function isDividendExDateInRange(exDate: string, from: string, to: string): boolean {
  return exDate >= from && exDate <= to;
}

function parseEventTime(row: EodhdEarningsRow): "before_market" | "after_market" | "during_market" | "unknown" {
  const session = String(row.before_after_market ?? row.time ?? row.session ?? "")
    .trim()
    .toLowerCase();
  if (session.includes("before") || session === "bmo") return "before_market";
  if (session.includes("after") || session === "amc") return "after_market";
  if (session.includes("during")) return "during_market";
  return "unknown";
}

async function fetchEodhdEarningsCalendar(from: string, to: string): Promise<EodhdEarningsRow[]> {
  const token = process.env.EODHD_API_KEY?.trim();
  if (!token) return [];

  const params = new URLSearchParams({
    api_token: token,
    fmt: "json",
    from,
    to,
  });
  const url = `https://eodhd.com/api/calendar/earnings?${params.toString()}`;
  const response = await fetch(url);
  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`EODHD earnings calendar HTTP ${response.status}: ${bodyText.slice(0, 280)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new Error("EODHD earnings calendar invalid JSON");
  }
  if (Array.isArray(parsed)) return parsed as EodhdEarningsRow[];
  if (parsed && typeof parsed === "object") {
    const earnings = (parsed as { earnings?: unknown }).earnings;
    if (Array.isArray(earnings)) return earnings as EodhdEarningsRow[];
  }
  return [];
}

export async function fetchEodhdDividendHistoryForSymbol(
  symbol: string,
  apiToken: string,
): Promise<EodhdDividendHistoryRow[]> {
  const normalized = normalizeEodhdSymbol(symbol);
  if (!normalized) return [];

  const params = new URLSearchParams({
    api_token: apiToken,
    fmt: "json",
  });
  const url = `https://eodhd.com/api/div/${encodeURIComponent(normalized)}?${params.toString()}`;
  const response = await fetch(url);
  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`EODHD div ${normalized} HTTP ${response.status}: ${bodyText.slice(0, 280)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new Error(`EODHD div ${normalized} invalid JSON`);
  }
  if (!Array.isArray(parsed)) return [];
  return parsed as EodhdDividendHistoryRow[];
}

function earningsTitle(symbol: string, daysTo: number, eventTime: string): string {
  if (daysTo <= 0) return `${symbol} — wyniki dzisiaj`;
  if (daysTo === 1) return `${symbol} — wyniki jutro`;
  return `${symbol} — wyniki za ${daysTo} dni`;
}

function earningsSummary(symbol: string, daysTo: number): string {
  if (daysTo <= 1) {
    return `${symbol} publikuje wyniki wkrótce. Sprawdź ekspozycję, wielkość pozycji i plan reakcji przed publikacją.`;
  }
  return `${symbol} publikuje wyniki za ${daysTo} dni. Historycznie to okres podwyższonej zmienności — przygotuj plan przed wydarzeniem.`;
}

function dividendSummary(symbol: string, daysTo: number): string {
  if (daysTo <= 2) {
    return `${symbol} ma ex-dividend date za ${daysTo} dni. Jeżeli kupujesz pod dywidendę, uwzględnij korektę kursu po odcięciu.`;
  }
  return `${symbol} — nadchodząca data ex-dividend za ${daysTo} dni.`;
}

export function mapEodhdEarningsRows(rows: EodhdEarningsRow[], now = new Date()): NormalizedMarketEvent[] {
  const out: NormalizedMarketEvent[] = [];
  for (const row of rows) {
    const symbol = normalizeEodhdSymbol(row.code ?? row.symbol ?? row.ticker);
    const eventDate =
      parseDateOnly(row.report_date ?? row.date ?? row.earnings_date ?? row.event_date);
    if (!symbol || !eventDate) continue;

    const daysTo = daysUntilEventDate(eventDate, now);
    if (daysTo < -2 || daysTo > 30) continue;

    const eventTime = parseEventTime(row);
    const fiscalPeriod = String(row.period ?? row.fiscal_period ?? "").trim() || null;
    const epsEstimate = row.eps_estimate ?? row.estimate;
    const epsActual = row.eps_actual ?? row.actual;

    const subtype =
      epsActual != null && String(epsActual).trim() !== ""
        ? "published"
        : daysTo <= 0
          ? "today"
          : "upcoming";

    const importance =
      subtype === "published"
        ? "high"
        : earningsImportanceForDays(daysTo);

    out.push({
      symbol,
      eventType: "earnings",
      eventSubtype: subtype,
      eventDate,
      eventTime,
      importance,
      title: earningsTitle(symbol.split(".")[0] ?? symbol, daysTo, eventTime),
      summary: earningsSummary(symbol.split(".")[0] ?? symbol, daysTo),
      source: "eodhd_earnings_calendar",
      sourceUrl: "https://eodhd.com/financial-apis/calendar-upcoming-earnings-ipos-and-splits",
      dedupeKey: buildEarningsDedupeKey(symbol, eventDate, fiscalPeriod, subtype),
      payload: {
        epsEstimate: epsEstimate != null ? Number(epsEstimate) : null,
        epsActual: epsActual != null ? Number(epsActual) : null,
        revenueEstimate: row.revenue_estimate ?? null,
        revenueActual: row.revenue_actual ?? null,
        daysToEvent: daysTo,
      },
      fiscalPeriod,
    });
  }
  return out;
}

/**
 * Maps EODHD `/api/div/{symbol}` rows; filters by ex-date (`date`) in [from, to].
 */
export function mapEodhdDividendRows(
  rows: EodhdDividendHistoryRow[],
  symbol: string,
  from: string,
  to: string,
  now = new Date(),
): { events: NormalizedMarketEvent[]; rowsInRange: number } {
  const normalizedSymbol = normalizeEodhdSymbol(symbol);
  if (!normalizedSymbol) return { events: [], rowsInRange: 0 };

  const byKey = new Map<string, NormalizedMarketEvent>();
  let rowsInRange = 0;

  for (const row of rows) {
    const exDate = parseDateOnly(row.date ?? row.exDate ?? row.ex_date ?? row.ex_dividend_date);
    if (!exDate) continue;
    if (!isDividendExDateInRange(exDate, from, to)) continue;
    rowsInRange += 1;

    const paymentDate = parseDateOnly(row.paymentDate ?? row.payment_date);
    const recordDate = parseDateOnly(row.recordDate ?? row.record_date);
    const declarationDate = parseDateOnly(row.declarationDate ?? row.declaration_date);
    const period = String(row.period ?? "").trim() || null;
    const currency = String(row.currency ?? "USD").trim() || "USD";
    const rawAmount = row.value ?? row.unadjustedValue ?? row.dividend ?? row.amount;
    const dividendPerShare = rawAmount != null && rawAmount !== "" ? Number(rawAmount) : null;

    const daysTo = daysUntilEventDate(exDate, now);
    const importance = dividendImportanceForDays(daysTo);
    const label = normalizedSymbol.split(".")[0] ?? normalizedSymbol;
    const dedupeKey = buildDividendDedupeKey(normalizedSymbol, exDate, paymentDate);

    const event: NormalizedMarketEvent = {
      symbol: normalizedSymbol,
      eventType: "dividend",
      eventSubtype: daysTo <= 0 ? "ex_today" : "ex_upcoming",
      eventDate: exDate,
      importance,
      title: `${label} — ex-dividend ${daysTo <= 0 ? "dzisiaj" : `za ${daysTo} dni`}`,
      summary: dividendSummary(label, daysTo),
      source: "eodhd_dividends_history",
      sourceUrl: `https://eodhd.com/financial-apis/dividends-api`,
      dedupeKey,
      payload: {
        exDividendDate: exDate,
        declarationDate,
        recordDate,
        paymentDate,
        dividendPerShare: Number.isFinite(dividendPerShare) ? dividendPerShare : null,
        currency,
        period,
        daysToEvent: daysTo,
      },
    };

    byKey.set(dedupeKey, event);
  }

  return { events: [...byKey.values()], rowsInRange };
}

type DividendSyncStats = {
  symbolsRequested: number;
  symbolsChecked: number;
  rowsFetched: number;
  rowsInRange: number;
  eventsMapped: number;
  errors: number;
};

async function fetchDividendsForSymbols(
  symbols: string[],
  from: string,
  to: string,
  now = new Date(),
): Promise<{ events: NormalizedMarketEvent[]; stats: DividendSyncStats }> {
  const token = process.env.EODHD_API_KEY?.trim();
  const stats: DividendSyncStats = {
    symbolsRequested: symbols.length,
    symbolsChecked: 0,
    rowsFetched: 0,
    rowsInRange: 0,
    eventsMapped: 0,
    errors: 0,
  };

  if (!token || symbols.length === 0) {
    return { events: [], stats };
  }

  const limit = marketEventsDividendSymbolLimit();
  const uniqueSymbols = [
    ...new Set(
      symbols
        .map((s) => normalizeEodhdSymbol(s))
        .filter((s): s is string => Boolean(s)),
    ),
  ].slice(0, limit);

  const byKey = new Map<string, NormalizedMarketEvent>();

  for (const symbol of uniqueSymbols) {
    stats.symbolsChecked += 1;
    try {
      const rows = await fetchEodhdDividendHistoryForSymbol(symbol, token);
      stats.rowsFetched += rows.length;
      const mapped = mapEodhdDividendRows(rows, symbol, from, to, now);
      stats.rowsInRange += mapped.rowsInRange;
      for (const event of mapped.events) {
        byKey.set(event.dedupeKey, event);
      }
    } catch {
      stats.errors += 1;
    }
  }

  const events = [...byKey.values()];
  stats.eventsMapped = events.length;

  console.info(
    JSON.stringify({
      type: "market_events_dividend_sync",
      from,
      to,
      symbolLimit: limit,
      ...stats,
      eventsAfterDedupe: events.length,
    }),
  );

  return { events, stats };
}

export async function fetchNormalizedMarketEventsFromEodhd(
  from: string,
  to: string,
  trackedSymbols: string[] = [],
): Promise<NormalizedMarketEvent[]> {
  const now = new Date();
  const [earningsRows, dividendResult] = await Promise.all([
    fetchEodhdEarningsCalendar(from, to).catch(() => [] as EodhdEarningsRow[]),
    fetchDividendsForSymbols(trackedSymbols, from, to, now),
  ]);

  const merged = [
    ...mapEodhdEarningsRows(earningsRows, now),
    ...dividendResult.events,
  ];

  const byKey = new Map<string, NormalizedMarketEvent>();
  for (const event of merged) {
    byKey.set(event.dedupeKey, event);
  }
  return [...byKey.values()];
}
