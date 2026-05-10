import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../../db/index";

const LOOKBACK_DAYS = 90;
const HIGH_RISK_THRESHOLD = 0.7;

export type CorrelationRow = {
  symbol: string;
  correlation: number;
  warning: boolean;
};

export type HighRiskPair = {
  a: string;
  b: string;
  correlation: number;
};

export type CorrelationAnalyzeResult = {
  correlations: CorrelationRow[];
  highRiskPairs: HighRiskPair[];
  insight: string;
};

type QuotePoint = { symbol: string; timestamp: Date; close: number };

type CorrelationDeps = {
  db: {
    quote: {
      findMany: (args: Record<string, unknown>) => Promise<QuotePoint[]>;
    };
  };
  runAiInsight: (pairsLabel: string, fallback: string) => Promise<string>;
};

function normalizeSymbol(value: string): string {
  return String(value ?? "").trim().toUpperCase();
}

function toDateKey(ts: Date): string {
  return ts.toISOString().slice(0, 10);
}

function buildSeriesBySymbol(rows: QuotePoint[]): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const symbol = normalizeSymbol(row.symbol);
    if (!symbol || !Number.isFinite(row.close)) continue;
    const dateKey = toDateKey(row.timestamp);
    if (!out.has(symbol)) out.set(symbol, new Map<string, number>());
    out.get(symbol)!.set(dateKey, Number(row.close));
  }
  return out;
}

function pearsonFromMaps(a: Map<string, number> | undefined, b: Map<string, number> | undefined): number | null {
  if (!a || !b || a.size < 2 || b.size < 2) return null;
  const x: number[] = [];
  const y: number[] = [];
  for (const [date, left] of a.entries()) {
    const right = b.get(date);
    if (right == null) continue;
    x.push(left);
    y.push(right);
  }
  const n = x.length;
  if (n < 2) return null;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  let sumY2 = 0;
  for (let i = 0; i < n; i += 1) {
    const xi = x[i]!;
    const yi = y[i]!;
    sumX += xi;
    sumY += yi;
    sumXY += xi * yi;
    sumX2 += xi * xi;
    sumY2 += yi * yi;
  }

  const numerator = n * sumXY - sumX * sumY;
  const denomLeft = n * sumX2 - sumX * sumX;
  const denomRight = n * sumY2 - sumY * sumY;
  const denominator = Math.sqrt(denomLeft * denomRight);
  if (!Number.isFinite(denominator) || denominator <= 0) return null;
  const value = numerator / denominator;
  if (!Number.isFinite(value)) return null;
  return Math.max(-1, Math.min(1, Number(value.toFixed(4))));
}

function fallbackInsight(highRiskPairs: HighRiskPair[]): string {
  if (highRiskPairs.length === 0) {
    return "No dangerous pair correlation detected; keep diversification discipline as market regimes change.";
  }
  const pairText = highRiskPairs.map((pair) => `${pair.a}/${pair.b}`).join(", ");
  return `High correlation in ${pairText}; one shock can hit multiple positions simultaneously.`;
}

function normalizeInsight(raw: string, fallback: string): string {
  const text = String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!text) return fallback;
  const words = text.split(" ");
  if (words.length <= 15) return text;
  return `${words.slice(0, 15).join(" ")}.`;
}

async function defaultRunAiInsight(pairsLabel: string, fallback: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return fallback;
  try {
    const client = new Anthropic({ apiKey });
    const prompt = `Portfolio has high correlation between ${pairsLabel}. Write 1 risk warning, max 15 words.`;
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 80,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });
    const block = message.content[0];
    const text = block?.type === "text" ? block.text : "";
    return normalizeInsight(text, fallback);
  } catch {
    return fallback;
  }
}

export function createCorrelationService(customDeps?: Partial<CorrelationDeps>) {
  const deps: CorrelationDeps = {
    db: customDeps?.db ??
      ({
        quote: prisma.quote,
      } as unknown as CorrelationDeps["db"]),
    runAiInsight: customDeps?.runAiInsight ?? defaultRunAiInsight,
  };

  async function analyze(symbolInput: string, portfolioInput: string[]): Promise<CorrelationAnalyzeResult> {
    const symbol = normalizeSymbol(symbolInput);
    if (!symbol) throw new Error("Missing symbol");
    if (!Array.isArray(portfolioInput)) throw new Error("Portfolio must be an array");

    const portfolioSymbols = portfolioInput
      .map((item) => normalizeSymbol(item))
      .filter((item) => item.length > 0);
    const uniqPortfolio = Array.from(new Set(portfolioSymbols));
    const comparisonSymbols = uniqPortfolio.filter((item) => item !== symbol);
    const allSymbols = Array.from(new Set([symbol, ...comparisonSymbols]));

    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - LOOKBACK_DAYS);

    const rows = await deps.db.quote.findMany({
      where: {
        symbol: { in: allSymbols },
        timestamp: { gte: cutoff },
      },
      orderBy: { timestamp: "asc" },
      select: { symbol: true, timestamp: true, close: true },
    });

    const seriesBySymbol = buildSeriesBySymbol(
      rows.map((row) => ({
        symbol: String(row.symbol),
        timestamp: row.timestamp instanceof Date ? row.timestamp : new Date(row.timestamp),
        close: Number(row.close),
      })),
    );

    const correlations: CorrelationRow[] = comparisonSymbols.map((other) => {
      const value = pearsonFromMaps(seriesBySymbol.get(symbol), seriesBySymbol.get(other)) ?? 0;
      return {
        symbol: other,
        correlation: value,
        warning: value > HIGH_RISK_THRESHOLD,
      };
    });

    const highRiskPairs: HighRiskPair[] = [];
    for (let i = 0; i < allSymbols.length; i += 1) {
      for (let j = i + 1; j < allSymbols.length; j += 1) {
        const a = allSymbols[i]!;
        const b = allSymbols[j]!;
        const value = pearsonFromMaps(seriesBySymbol.get(a), seriesBySymbol.get(b));
        if (value != null && value > HIGH_RISK_THRESHOLD) {
          highRiskPairs.push({ a, b, correlation: value });
        }
      }
    }

    const fallback = fallbackInsight(highRiskPairs);
    const pairsLabel =
      highRiskPairs.length > 0
        ? highRiskPairs.map((pair) => `${pair.a}-${pair.b} (${pair.correlation.toFixed(2)})`).join(", ")
        : "none";
    const insight = await deps.runAiInsight(pairsLabel, fallback);

    return { correlations, highRiskPairs, insight };
  }

  return { analyze };
}

let correlationServiceSingleton: ReturnType<typeof createCorrelationService> | null = null;

function getCorrelationService() {
  if (!correlationServiceSingleton) {
    correlationServiceSingleton = createCorrelationService();
  }
  return correlationServiceSingleton;
}

export async function analyzeCorrelations(
  symbol: string,
  portfolio: string[],
): Promise<CorrelationAnalyzeResult> {
  return getCorrelationService().analyze(symbol, portfolio);
}
