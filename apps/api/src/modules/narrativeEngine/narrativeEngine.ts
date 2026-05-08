import Anthropic from "@anthropic-ai/sdk";
import type { MarketRegime } from "../../marketRegime";
import type { DividendData } from "../dividend/dividendModule";

type NarrativeConfidence = "HIGH" | "MEDIUM" | "LOW";

export type NarrativeContext = {
  signal: {
    ticker: string;
    setupType: string;
    rsiValue: number;
    volumeRatio: number;
    score: number;
  };
  regime: MarketRegime;
  dna: {
    avgResultPct: number;
    winRate: number;
    bestCase: number;
    worstCase: number;
    topTwin?: {
      ticker: string;
      date: string;
      resultPct: number;
    } | null;
    twinsCount?: number;
  };
  exitLevels: {
    entry: number;
    sl: number;
    tp: number;
    riskRewardRatio: number;
  };
  dividendData?: DividendData;
};

export type NarrativeOutput = {
  headline: string;
  body: string;
  riskNote: string;
  confidence: NarrativeConfidence;
};

function toConfidence(value: string | undefined): NarrativeConfidence {
  const v = (value ?? "").trim().toUpperCase();
  if (v === "HIGH" || v === "MEDIUM" || v === "LOW") return v;
  return "MEDIUM";
}

function fallbackNarrative(context: NarrativeContext): NarrativeOutput {
  const ticker = context.signal.ticker.toUpperCase();
  const rr = Number.isFinite(context.exitLevels.riskRewardRatio)
    ? context.exitLevels.riskRewardRatio.toFixed(2)
    : "n/a";
  return {
    headline: `${ticker}: ${context.signal.setupType} w reżimie ${context.regime.regime} z wynikiem ${Math.round(context.signal.score)}/100.`,
    body: `Setup opiera się na RSI ${context.signal.rsiValue.toFixed(1)} i wolumenie ${context.signal.volumeRatio.toFixed(2)}x średniej. Signal DNA pokazuje win rate ${context.dna.winRate.toFixed(1)}% oraz średni wynik ${context.dna.avgResultPct.toFixed(2)}%. Poziomy transakcyjne to entry ${context.exitLevels.entry.toFixed(2)}, SL ${context.exitLevels.sl.toFixed(2)}, TP ${context.exitLevels.tp.toFixed(2)} przy R/R ${rr}.`,
    riskNote: `Główne ryzyko: szybka zmiana reżimu ${context.regime.regime} może zanegować przewagę setupu.`,
    confidence: context.signal.score >= 80 ? "HIGH" : context.signal.score >= 60 ? "MEDIUM" : "LOW",
  };
}

function parseJsonNarrative(raw: string): NarrativeOutput | null {
  try {
    const parsed = JSON.parse(raw) as Partial<NarrativeOutput>;
    if (!parsed.headline || !parsed.body || !parsed.riskNote) return null;
    return {
      headline: String(parsed.headline).trim(),
      body: String(parsed.body).trim(),
      riskNote: String(parsed.riskNote).trim(),
      confidence: toConfidence(parsed.confidence),
    };
  } catch {
    return null;
  }
}

export async function generateNarrative(context: NarrativeContext): Promise<NarrativeOutput> {
  const fallback = fallbackNarrative(context);
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return fallback;

  const topTwin = context.dna.topTwin;
  const dividendLine = context.dividendData
    ? `Dywidenda: ${context.dividendData.dividendYield.toFixed(2)}%, Health: ${context.dividendData.healthLabel}`
    : "";
  const prompt = [
    `Ticker: ${context.signal.ticker.toUpperCase()}`,
    `Setup: ${context.signal.setupType}, Score: ${Math.round(context.signal.score)}/100`,
    `RSI: ${context.signal.rsiValue}, Wolumen: ${context.signal.volumeRatio}x średniej`,
    `Reżim rynkowy: ${context.regime.regime} (confidence: ${context.regime.confidence}%)`,
    `Signal DNA: ${context.dna.winRate.toFixed(2)}% win rate na ${context.dna.twinsCount ?? 0} podobnych setupach, średni wynik +${context.dna.avgResultPct.toFixed(2)}%`,
    topTwin
      ? `Najbliższy bliźniak: ${topTwin.ticker} ${topTwin.date}, wynik +${topTwin.resultPct.toFixed(2)}%`
      : "Najbliższy bliźniak: brak",
    `Poziomy: Entry ${context.exitLevels.entry}, SL ${context.exitLevels.sl}, TP ${context.exitLevels.tp}, R/R ${context.exitLevels.riskRewardRatio}`,
    dividendLine,
    "",
    "Napisz:",
    "1. HEADLINE: 1 zdanie — kluczowy insight",
    "2. BODY: 3-4 zdania — pełna analiza łącząca reżim + DNA + setup",
    "3. RISK: 1 zdanie — główne ryzyko",
    "4. CONFIDENCE: HIGH/MEDIUM/LOW",
    "",
    "Format odpowiedzi JSON:",
    "{ headline, body, riskNote, confidence }",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const client = new Anthropic({ apiKey });
    const model = process.env.ANTHROPIC_SIGNAL_BRIEF_MODEL?.trim() || "claude-sonnet-4-6";
    const msg = await client.messages.create({
      model,
      max_tokens: 500,
      system:
        "Jesteś analitykiem giełdowym. Piszesz po polsku. Styl: konkretny, bez owijania w bawełnę. Nie używaj słów: 'potencjalnie', 'możliwe że', 'wydaje się'.",
      messages: [{ role: "user", content: prompt }],
    });
    const raw = msg.content[0];
    const text = raw?.type === "text" ? raw.text.trim() : "";
    const parsed = parseJsonNarrative(text);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}
