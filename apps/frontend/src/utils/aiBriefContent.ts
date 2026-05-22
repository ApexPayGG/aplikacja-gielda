import type { TFunction } from "i18next";

export type SectorSentimentLabel = "bearish" | "neutral" | "bullish";

export type SectorSentiment = {
  score: number;
  label: SectorSentimentLabel;
};

export type AIBriefInsight = {
  morningBullets: [string, string, string];
  sentiment: SectorSentiment;
  behavioralWarning: string;
};

function hashSymbol(symbol: string): number {
  let hash = 0;
  for (let i = 0; i < symbol.length; i += 1) {
    hash = (hash * 31 + symbol.charCodeAt(i)) >>> 0;
  }
  return hash;
}

const MORNING_TEMPLATE_KEYS: ReadonlyArray<readonly [string, string, string]> = [
  [
    "aiBrief.mock.morning0.bullet1",
    "aiBrief.mock.morning0.bullet2",
    "aiBrief.mock.morning0.bullet3",
  ],
  [
    "aiBrief.mock.morning1.bullet1",
    "aiBrief.mock.morning1.bullet2",
    "aiBrief.mock.morning1.bullet3",
  ],
  [
    "aiBrief.mock.morning2.bullet1",
    "aiBrief.mock.morning2.bullet2",
    "aiBrief.mock.morning2.bullet3",
  ],
  [
    "aiBrief.mock.morning3.bullet1",
    "aiBrief.mock.morning3.bullet2",
    "aiBrief.mock.morning3.bullet3",
  ],
] as const;

const MORNING_DEFAULTS: ReadonlyArray<readonly [string, string, string]> = [
  [
    "The session opens under rotation pressure from growth into value; institutional investors are trimming short-horizon exposure after a strong macro print.",
    "The earnings calendar points to key operating-margin reads — consensus expects stabilization, but guidance could surprise higher if B2B demand holds.",
    "Liquidity in the first trading hour is elevated; overnight volume suggests active portfolio diversification ahead of this week's Fed decision.",
  ],
  [
    "Prices are reacting to services PMI above forecasts, supporting a soft-landing narrative and short-term risk-on in cyclical defensives.",
    "Corporate bond spreads are tightening, signaling improved risk appetite; dividends and buybacks remain the main valuation catalyst in large caps.",
    "Analysts are raising price targets after better-than-expected segment revenue; focus is on sustaining free cash flow in Q2.",
  ],
  [
    "The market is discounting slower consumer demand, yet advance orders in the supply chain still align with the production plan.",
    "Energy commodity swings are capping gross-margin expansion; management signaled cost hedging through fiscal year-end.",
    "Short speculative positions are shrinking after positive management commentary at an industry conference — sentiment is improving gradually.",
  ],
  [
    "The sector index is in a technical pullback after testing resistance; capital is returning to companies with strong balance sheets and low net debt.",
    "US employment data reinforces expectations for a longer pause in the rate-hike cycle, which supports medium-term growth valuations.",
    "Insider buying over the last two weeks supports the thesis of attractive pricing versus historical average EV/EBITDA.",
  ],
];

const BEHAVIORAL_WARNING_KEYS = [
  "aiBrief.mock.warning0",
  "aiBrief.mock.warning1",
  "aiBrief.mock.warning2",
  "aiBrief.mock.warning3",
  "aiBrief.mock.warning4",
] as const;

const BEHAVIORAL_WARNING_DEFAULTS = [
  "Retail sentiment is extremely euphoric. Stay disciplined and avoid FOMO at current valuations.",
  "Speculative volume is rising faster than fundamentals. Consider capping position size and planning a stop-loss before entry.",
  "Media noise after quarterly results distorts risk perception. Wait for confirmation from institutional volume.",
  "Correlation with the broad market index is high — diversification within the sector does not reduce systemic risk in the short term.",
  "Historical volatility after guidance releases can be double the average. Avoid impulsive decisions in the first hour of trading.",
] as const;

function sentimentFromHash(hash: number, sector: string): SectorSentiment {
  let score = 18 + (hash % 65);
  if (sector.toLowerCase().includes("tech")) {
    score = Math.min(100, score + 4);
  }
  if (score < 38) {
    return { score, label: "bearish" };
  }
  if (score > 62) {
    return { score, label: "bullish" };
  }
  return { score, label: "neutral" };
}

export function buildAIBriefInsight(symbol: string, sector: string, t: TFunction): AIBriefInsight {
  const hash = hashSymbol(symbol.trim().toUpperCase());
  const templateIndex = hash % MORNING_TEMPLATE_KEYS.length;
  const keys = MORNING_TEMPLATE_KEYS[templateIndex] ?? MORNING_TEMPLATE_KEYS[0];
  const defaults = MORNING_DEFAULTS[templateIndex] ?? MORNING_DEFAULTS[0];
  const morningBullets = keys.map((key, index) =>
    t(key, { defaultValue: defaults[index] }),
  ) as [string, string, string];
  const warningIndex = (hash >> 4) % BEHAVIORAL_WARNING_KEYS.length;
  const warningKey = BEHAVIORAL_WARNING_KEYS[warningIndex] ?? BEHAVIORAL_WARNING_KEYS[0];
  const warningDefault =
    BEHAVIORAL_WARNING_DEFAULTS[warningIndex] ?? BEHAVIORAL_WARNING_DEFAULTS[0];

  return {
    morningBullets,
    sentiment: sentimentFromHash(hash, sector),
    behavioralWarning: t(warningKey, { defaultValue: warningDefault }),
  };
}

export function sentimentLabelText(label: SectorSentimentLabel, t: TFunction): string {
  if (label === "bearish") return t("aiBriefDrawer.bearish", { defaultValue: "Bearish" });
  if (label === "bullish") return t("aiBriefDrawer.bullish", { defaultValue: "Bullish" });
  return t("aiBriefDrawer.neutral", { defaultValue: "Neutral" });
}
