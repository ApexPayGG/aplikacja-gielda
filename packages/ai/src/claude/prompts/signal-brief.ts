import type { SignalBriefInput } from "../client";

export function buildSignalBriefPrompt(input: SignalBriefInput): string {
  const newsLines =
    input.recent_news.length > 0
      ? input.recent_news.map((item, idx) => `${idx + 1}. ${item}`).join("\n")
      : "1. (no recent news provided)";

  return [
    "TECHNICAL DATA",
    `- ticker: ${input.ticker}`,
    `- pattern: ${input.pattern_type}`,
    `- confidence: ${input.confidence}`,
    `- RSI: ${input.rsi}`,
    `- MACD: ${input.macd}`,
    `- volume_ratio: ${input.volume_ratio}`,
    `- support_level: ${input.support_level}`,
    `- price_position: ${input.price_position}`,
    "",
    "HISTORICAL BACKTEST",
    `- similar_setups: ${input.historical_count}`,
    `- win_rate: ${input.win_rate}%`,
    `- avg_return_10d: ${input.avg_return_10d}`,
    `- max_drawdown: ${input.max_drawdown}`,
    "",
    "RECENT NEWS",
    `${newsLines}`,
    `Sentiment: ${input.market_sentiment}`,
    "",
    "MACRO CONTEXT",
    `- market_sentiment: ${input.market_sentiment}`,
    `- sector_trend: ${input.sector_trend}`,
    `- VIX level: ${input.vix}`,
    "",
    "TASK",
    "Generate ~300-word brief in Polish AND English.",
    "Structure each language section as:",
    "1) What happened (technical setup + context)",
    "2) Why it matters (backtest + fundamentals)",
    "3) Risk factors (what could go wrong)",
    "Output format must be exactly:",
    "=== PL ===",
    "[Polish brief]",
    "",
    "=== EN ===",
    "[English brief]",
    "",
    "This is NOT investment advice, ONLY analysis.",
  ].join("\n");
}
