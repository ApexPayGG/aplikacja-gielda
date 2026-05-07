import type { ParsedIntent } from "./intent-parser";

const EXCHANGE_WHITELIST = new Set(["GPW", "NYSE", "DAX", "HKEX", "NASDAQ"]);

export function generateSQL(intent: ParsedIntent): { query: string; params: any[] } {
  const where: string[] = [];
  const params: any[] = [];

  const markets = intent.market.map((m) => String(m).trim().toUpperCase()).filter(Boolean);
  for (const m of markets) {
    if (!EXCHANGE_WHITELIST.has(m)) {
      throw new Error(`Invalid exchange "${m}"`);
    }
  }

  if (markets.length === 1) {
    where.push("s.exchange = ?");
    params.push(markets[0]);
  } else if (markets.length > 1) {
    where.push(`s.exchange IN (${markets.map(() => "?").join(", ")})`);
    params.push(...markets);
  }

  if (intent.pattern) {
    where.push("s.pattern_type = ?");
    params.push(intent.pattern);
  }

  if (intent.filters.sector) {
    where.push("c.sector = ?");
    params.push(intent.filters.sector);
  }

  if (intent.filters.dy_min !== undefined) {
    where.push("d.dividend_yield >= ?");
    params.push(intent.filters.dy_min);
  }

  if (intent.filters.dy_max !== undefined) {
    where.push("d.dividend_yield <= ?");
    params.push(intent.filters.dy_max);
  }

  if (intent.filters.payout_ratio_max !== undefined) {
    where.push("d.payout_ratio <= ?");
    params.push(intent.filters.payout_ratio_max);
  }

  if (intent.filters.trend) {
    where.push("d.trend = ?");
    params.push(intent.filters.trend);
  }

  if (intent.filters.market_cap_min !== undefined) {
    where.push("c.market_cap >= ?");
    params.push(intent.filters.market_cap_min);
  }

  if (intent.filters.years_of_dividend !== undefined) {
    where.push("d.years_of_growth >= ?");
    params.push(intent.filters.years_of_dividend);
  }

  const query = [
    "SELECT s.id, s.ticker, s.exchange, s.score, s.brief_pl, s.brief_en,",
    "       c.sector, c.logo, c.market_cap,",
    "       d.dividend_yield, d.payout_ratio, d.years_of_growth",
    "FROM signals s",
    "JOIN companies c ON s.ticker = c.ticker",
    "LEFT JOIN dividends d ON s.ticker = d.ticker",
    where.length ? `WHERE ${where.join(" AND ")}` : "",
    "ORDER BY s.score DESC",
    "LIMIT 20",
  ]
    .filter(Boolean)
    .join("\n");

  return { query, params };
}
