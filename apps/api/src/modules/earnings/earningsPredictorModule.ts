import Anthropic from "@anthropic-ai/sdk";
import process from "node:process";
import { prisma } from "../../db/index";

const EARNINGS_MODEL = "claude-sonnet-4-20250514";
const DEFAULT_REASONING = "Insufficient quality inputs; probability based on mixed recent signals.";

type PredictionLabel = "BEAT" | "MISS" | "IN_LINE";

type FundamentalRow = {
  metric: string;
  value: unknown;
  year: number;
  lastUpdated: Date;
};

type EodhdEarningsRow = Record<string, unknown>;

type ClaudePayload = {
  prediction?: unknown;
  confidence?: unknown;
  reasoning?: unknown;
};

type EarningsDeps = {
  db: {
    fundamental: {
      findMany: (args: Record<string, unknown>) => Promise<FundamentalRow[]>;
    };
  };
  fetchEarningsFn: (symbol: string) => Promise<EodhdEarningsRow[]>;
  runPredictionFn: (input: {
    symbol: string;
    pe: number;
    revenueGrowth: number;
    epsEstimate: number;
    history: string;
  }) => Promise<{ prediction: PredictionLabel; confidence: number; reasoning: string }>;
};

export type EarningsPredictionResult = {
  symbol: string;
  prediction: PredictionLabel;
  confidence: number;
  reasoning: string;
  nextEarningsDate: string | null;
};

function toNumber(value: unknown): number | null {
  const asNumber = Number(value);
  return Number.isFinite(asNumber) ? asNumber : null;
}

function clamp(num: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, num));
}

function normalizePrediction(value: unknown): PredictionLabel {
  const upper = String(value ?? "")
    .trim()
    .toUpperCase();
  if (upper === "BEAT") return "BEAT";
  if (upper === "MISS") return "MISS";
  return "IN_LINE";
}

function normalizeReasoning(value: unknown): string {
  const text = String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!text) return DEFAULT_REASONING;
  const words = text.split(" ");
  if (words.length <= 30) return text;
  return words.slice(0, 30).join(" ");
}

function parseJsonFromText(raw: string): ClaudePayload | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(withoutFence) as ClaudePayload;
  } catch {
    const match = withoutFence.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]) as ClaudePayload;
    } catch {
      return null;
    }
  }
}

function getMetricValue(rows: FundamentalRow[], metricCandidates: string[]): number | null {
  const normalized = metricCandidates.map((m) => m.toLowerCase());
  const found = rows
    .filter((row) => normalized.includes(String(row.metric ?? "").toLowerCase()))
    .sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      return b.lastUpdated.getTime() - a.lastUpdated.getTime();
    })[0];
  return found ? toNumber(found.value) : null;
}

function parseEarningsDate(row: EodhdEarningsRow): string | null {
  const raw = row.date ?? row.report_date ?? row.reportDate ?? row.earnings_date;
  if (!raw) return null;
  const date = new Date(String(raw));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function parseSurprisePercent(row: EodhdEarningsRow): number | null {
  const direct = toNumber(row.surprise_percent ?? row.surprisePercent);
  if (direct !== null) return direct;
  const actual = toNumber(row.eps_actual ?? row.epsActual);
  const estimate = toNumber(row.eps_estimate ?? row.epsEstimate);
  if (actual === null || estimate === null || estimate === 0) return null;
  return ((actual - estimate) / Math.abs(estimate)) * 100;
}

function parseEpsEstimate(row: EodhdEarningsRow): number | null {
  return toNumber(row.eps_estimate ?? row.epsEstimate);
}

function summarizeHistory(rows: EodhdEarningsRow[]): string {
  const now = Date.now();
  const past = rows
    .map((row) => ({ row, date: parseEarningsDate(row) }))
    .filter((entry) => {
      if (!entry.date) return false;
      return new Date(entry.date).getTime() <= now;
    })
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())
    .slice(0, 3)
    .map((entry) => {
      const surprise = parseSurprisePercent(entry.row);
      if (surprise === null) return `${entry.date}: n/a`;
      return `${entry.date}: ${surprise.toFixed(2)}%`;
    });
  return past.length > 0 ? past.join(", ") : "No recent surprises";
}

function findNextEarningsDate(rows: EodhdEarningsRow[]): string | null {
  const now = Date.now();
  const dates = rows
    .map((row) => parseEarningsDate(row))
    .filter((date): date is string => Boolean(date))
    .map((date) => new Date(date).getTime())
    .filter((ts) => ts >= now)
    .sort((a, b) => a - b);
  if (dates.length === 0) return null;
  return new Date(dates[0]).toISOString().slice(0, 10);
}

async function fetchEarningsFromEodhd(symbol: string): Promise<EodhdEarningsRow[]> {
  const token = process.env.EODHD_API_KEY?.trim();
  if (!token) throw new Error("EODHD_API_KEY is not set. Earnings predictor requires EODHD API.");
  const params = new URLSearchParams({
    api_token: token,
    fmt: "json",
    symbols: symbol,
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
    throw new Error(`EODHD earnings calendar invalid JSON: ${bodyText.slice(0, 200)}`);
  }
  if (Array.isArray(parsed)) return parsed as EodhdEarningsRow[];
  return [];
}

async function runClaudePrediction(input: {
  symbol: string;
  pe: number;
  revenueGrowth: number;
  epsEstimate: number;
  history: string;
}): Promise<{ prediction: PredictionLabel; confidence: number; reasoning: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set. Earnings predictor requires Claude.");
  const prompt = `Analyze earnings surprise probability for ${input.symbol}.
PE: ${input.pe}, Revenue growth: ${input.revenueGrowth}%, EPS estimate: ${input.epsEstimate},
Last 3 surprises: ${input.history}.
Return JSON: {
  prediction: 'BEAT'|'MISS'|'IN_LINE',
  confidence: number (0-100),
  reasoning: string (max 30 words)
}`;
  const client = new Anthropic({ apiKey });
  const message = await client.messages.create({
    model: EARNINGS_MODEL,
    max_tokens: 220,
    temperature: 0,
    messages: [{ role: "user", content: prompt }],
  });
  const first = message.content[0];
  const text = first?.type === "text" ? first.text : "";
  const parsed = parseJsonFromText(text);
  if (!parsed) {
    return { prediction: "IN_LINE", confidence: 50, reasoning: DEFAULT_REASONING };
  }
  const confidence = toNumber(parsed.confidence);
  return {
    prediction: normalizePrediction(parsed.prediction),
    confidence: confidence === null ? 50 : clamp(Math.round(confidence), 0, 100),
    reasoning: normalizeReasoning(parsed.reasoning),
  };
}

export function createEarningsPredictorService(depsInput?: Partial<EarningsDeps>) {
  const deps: EarningsDeps = {
    db: depsInput?.db ??
      ({
        fundamental: prisma.fundamental,
      } as unknown as EarningsDeps["db"]),
    fetchEarningsFn: depsInput?.fetchEarningsFn ?? fetchEarningsFromEodhd,
    runPredictionFn: depsInput?.runPredictionFn ?? runClaudePrediction,
  };

  async function predictEarningsSurprise(symbolInput: string): Promise<EarningsPredictionResult> {
    const symbol = String(symbolInput ?? "").trim().toUpperCase();
    if (!symbol) throw new Error("Missing symbol");

    const fundamentals = await deps.db.fundamental.findMany({
      where: {
        symbol,
        metric: {
          in: ["pe", "pe_ratio", "revenue_growth", "revenue_growth_pct", "revenue", "sales"],
        },
      },
      select: { metric: true, value: true, year: true, lastUpdated: true },
      orderBy: [{ year: "desc" }, { lastUpdated: "desc" }],
      take: 120,
    });

    const pe = getMetricValue(fundamentals, ["pe", "pe_ratio"]) ?? 0;

    const directRevenueGrowth = getMetricValue(fundamentals, ["revenue_growth", "revenue_growth_pct"]);
    let revenueGrowth = directRevenueGrowth ?? 0;
    if (directRevenueGrowth === null) {
      const revenueRows = fundamentals
        .filter((row) => {
          const metric = String(row.metric ?? "").toLowerCase();
          return metric === "revenue" || metric === "sales";
        })
        .sort((a, b) => b.year - a.year);
      if (revenueRows.length >= 2) {
        const currentRevenue = toNumber(revenueRows[0].value);
        const previousRevenue = toNumber(revenueRows[1].value);
        if (
          currentRevenue !== null &&
          previousRevenue !== null &&
          previousRevenue !== 0
        ) {
          revenueGrowth = ((currentRevenue - previousRevenue) / Math.abs(previousRevenue)) * 100;
        }
      }
    }

    const earningsRows = await deps.fetchEarningsFn(symbol);
    const nextEarningsDate = findNextEarningsDate(earningsRows);
    const history = summarizeHistory(earningsRows);

    const latestEstimate =
      earningsRows
        .map((row) => ({ row, date: parseEarningsDate(row) }))
        .sort((a, b) => {
          const aTs = a.date ? new Date(a.date).getTime() : 0;
          const bTs = b.date ? new Date(b.date).getTime() : 0;
          return bTs - aTs;
        })
        .map((entry) => parseEpsEstimate(entry.row))
        .find((value): value is number => value !== null) ?? 0;

    const ai = await deps.runPredictionFn({
      symbol,
      pe: Number(pe.toFixed(2)),
      revenueGrowth: Number(revenueGrowth.toFixed(2)),
      epsEstimate: Number(latestEstimate.toFixed(4)),
      history,
    });

    return {
      symbol,
      prediction: ai.prediction,
      confidence: clamp(Math.round(ai.confidence), 0, 100),
      reasoning: normalizeReasoning(ai.reasoning),
      nextEarningsDate,
    };
  }

  return { predictEarningsSurprise };
}

let earningsPredictorServiceSingleton: ReturnType<typeof createEarningsPredictorService> | null = null;

function getEarningsPredictorService() {
  if (!earningsPredictorServiceSingleton) {
    earningsPredictorServiceSingleton = createEarningsPredictorService();
  }
  return earningsPredictorServiceSingleton;
}

export async function predictEarningsSurprise(symbol: string): Promise<EarningsPredictionResult> {
  return getEarningsPredictorService().predictEarningsSurprise(symbol);
}
