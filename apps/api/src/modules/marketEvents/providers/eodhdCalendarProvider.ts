import {
  buildDividendDedupeKey,
  buildEarningsDedupeKey,
  daysUntilEventDate,
  dividendImportanceForDays,
  earningsImportanceForDays,
} from "../dedupe";
import type { NormalizedMarketEvent } from "../types";

type EodhdEarningsRow = Record<string, unknown>;
type EodhdDividendRow = Record<string, unknown>;

function parseDateOnly(value: unknown): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function normalizeSymbol(code: unknown): string | null {
  const raw = String(code ?? "").trim().toUpperCase();
  if (!raw) return null;
  if (raw.includes(".")) return raw;
  return `${raw}.US`;
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

async function fetchEodhdCalendar<T>(
  path: "earnings" | "dividends",
  from: string,
  to: string,
): Promise<T[]> {
  const token = process.env.EODHD_API_KEY?.trim();
  if (!token) return [];

  const params = new URLSearchParams({
    api_token: token,
    fmt: "json",
    from,
    to,
  });
  const url = `https://eodhd.com/api/calendar/${path}?${params.toString()}`;
  const response = await fetch(url);
  const bodyText = await response.text();
  if (!response.ok) {
    throw new Error(`EODHD ${path} calendar HTTP ${response.status}: ${bodyText.slice(0, 280)}`);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    throw new Error(`EODHD ${path} calendar invalid JSON`);
  }
  if (Array.isArray(parsed)) return parsed as T[];
  if (parsed && typeof parsed === "object") {
    const earnings = (parsed as { earnings?: unknown }).earnings;
    if (Array.isArray(earnings)) return earnings as T[];
  }
  return [];
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
    const symbol = normalizeSymbol(row.code ?? row.symbol ?? row.ticker);
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

export function mapEodhdDividendRows(rows: EodhdDividendRow[], now = new Date()): NormalizedMarketEvent[] {
  const out: NormalizedMarketEvent[] = [];
  for (const row of rows) {
    const symbol = normalizeSymbol(row.code ?? row.symbol ?? row.ticker);
    const exDate = parseDateOnly(row.exDate ?? row.ex_date ?? row.ex_dividend_date);
    if (!symbol || !exDate) continue;

    const daysTo = daysUntilEventDate(exDate, now);
    if (daysTo < -1 || daysTo > 45) continue;

    const paymentDate = parseDateOnly(row.paymentDate ?? row.payment_date);
    const recordDate = parseDateOnly(row.recordDate ?? row.record_date);
    const amount = row.dividend ?? row.value ?? row.amount;
    const importance = dividendImportanceForDays(daysTo);

    out.push({
      symbol,
      eventType: "dividend",
      eventSubtype: daysTo <= 0 ? "ex_today" : "ex_upcoming",
      eventDate: exDate,
      importance,
      title: `${symbol.split(".")[0] ?? symbol} — ex-dividend ${daysTo <= 0 ? "dzisiaj" : `za ${daysTo} dni`}`,
      summary: dividendSummary(symbol.split(".")[0] ?? symbol, daysTo),
      source: "eodhd_dividends_calendar",
      sourceUrl: "https://eodhd.com/financial-apis/dividends-calendar-api",
      dedupeKey: buildDividendDedupeKey(symbol, exDate, paymentDate),
      payload: {
        exDividendDate: exDate,
        recordDate,
        paymentDate,
        dividendPerShare: amount != null ? Number(amount) : null,
        currency: row.currency ?? "USD",
        daysToEvent: daysTo,
      },
    });
  }
  return out;
}

export async function fetchNormalizedMarketEventsFromEodhd(
  from: string,
  to: string,
): Promise<NormalizedMarketEvent[]> {
  const [earningsRows, dividendRows] = await Promise.all([
    fetchEodhdCalendar<EodhdEarningsRow>("earnings", from, to).catch(() => [] as EodhdEarningsRow[]),
    fetchEodhdCalendar<EodhdDividendRow>("dividends", from, to).catch(() => [] as EodhdDividendRow[]),
  ]);

  const merged = [...mapEodhdEarningsRows(earningsRows), ...mapEodhdDividendRows(dividendRows)];

  const byKey = new Map<string, NormalizedMarketEvent>();
  for (const event of merged) {
    byKey.set(event.dedupeKey, event);
  }
  return [...byKey.values()];
}
