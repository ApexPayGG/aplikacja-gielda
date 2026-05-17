import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../../db/index";

const LEGENDS = ["BUFFETT", "LYNCH", "GREENBLATT", "SOROS"] as const;
type LegendName = (typeof LEGENDS)[number];

type TradeRow = {
  ticker: string;
  entryAt: Date;
  exitAt: Date | null;
  pnlPct: number | null;
  status: "OPEN" | "CLOSED";
};

type CompanyRow = {
  symbol: string;
  sector: string;
};

export type StrategyDnaStats = {
  avgHoldingDays: number;
  winRate: number;
  avgWinPct: number;
  avgLossPct: number;
  preferredSectors: string[];
  riskTolerance: number;
};

export type StrategyDnaLegendMatch = {
  name: LegendName;
  pct: number;
};

export type StrategyDnaResponse = {
  primary: StrategyDnaLegendMatch;
  secondary: StrategyDnaLegendMatch;
  insight: string;
  stats: StrategyDnaStats;
  hasEnoughData: boolean;
};

type StrategyDnaDeps = {
  db: {
    paperTrade: {
      findMany: (args: Record<string, unknown>) => Promise<TradeRow[]>;
    };
    company: {
      findMany: (args: Record<string, unknown>) => Promise<CompanyRow[]>;
    };
  };
  runAi: (stats: StrategyDnaStats, fallback: { primary: StrategyDnaLegendMatch; secondary: StrategyDnaLegendMatch; insight: string }) => Promise<{
    primary: StrategyDnaLegendMatch;
    secondary: StrategyDnaLegendMatch;
    insight: string;
  }>;
};

function toFixed(value: number, digits: number): number {
  return Number(value.toFixed(digits));
}

function safeMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeLegend(name: string): LegendName | null {
  const upper = name.trim().toUpperCase();
  return (LEGENDS as readonly string[]).includes(upper) ? (upper as LegendName) : null;
}

function normalizeInsight(raw: string): string {
  const text = raw.trim().replace(/\s+/g, " ");
  if (!text) return "Twoj styl laczy cierpliwosc z aktywnym zarzadzaniem ryzykiem.";
  const words = text.split(" ");
  if (words.length <= 20) return text;
  return `${words.slice(0, 20).join(" ")}.`;
}

function parseJsonFromText(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withoutFence = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(withoutFence);
  } catch {
    return null;
  }
}

function heuristicMatches(stats: StrategyDnaStats): { primary: StrategyDnaLegendMatch; secondary: StrategyDnaLegendMatch; insight: string } {
  const sectorCount = stats.preferredSectors.length;
  const diversified = sectorCount >= 3;
  const concentrated = sectorCount <= 2;
  const lowRisk = stats.riskTolerance > 0 && stats.riskTolerance < 0.7;
  const highRisk = stats.riskTolerance >= 1;
  const shortHold = stats.avgHoldingDays < 45;
  const fundamentalSectors = new Set(["Financial Services", "Utilities", "Healthcare", "Consumer Defensive", "Industrials"]);
  const preferFundamentals = stats.preferredSectors.some((sector) => fundamentalSectors.has(sector));

  const rawScores: Record<LegendName, number> = {
    BUFFETT: 0,
    LYNCH: 0,
    GREENBLATT: 0,
    SOROS: 0,
  };

  rawScores.BUFFETT += clamp((stats.avgHoldingDays - 120) / 2, 0, 35);
  rawScores.BUFFETT += stats.winRate > 0.6 ? 25 : clamp(stats.winRate * 40, 0, 25);
  rawScores.BUFFETT += lowRisk ? 25 : clamp((1.2 - stats.riskTolerance) * 15, 0, 15);
  rawScores.BUFFETT += preferFundamentals ? 15 : 0;

  rawScores.LYNCH += stats.avgHoldingDays >= 30 && stats.avgHoldingDays <= 180 ? 30 : 8;
  rawScores.LYNCH += diversified ? 25 : 8;
  rawScores.LYNCH += stats.winRate > 0.55 ? 25 : clamp(stats.winRate * 40, 0, 25);
  rawScores.LYNCH += stats.riskTolerance >= 0.5 && stats.riskTolerance <= 1.1 ? 20 : 10;

  rawScores.GREENBLATT += stats.avgHoldingDays < 90 ? 25 : 6;
  rawScores.GREENBLATT += stats.winRate > 0.62 ? 30 : clamp(stats.winRate * 40, 0, 30);
  rawScores.GREENBLATT += concentrated ? 25 : 10;
  rawScores.GREENBLATT += stats.avgWinPct >= 4 ? 20 : 8;

  rawScores.SOROS += highRisk ? 35 : 8;
  rawScores.SOROS += shortHold ? 25 : 8;
  rawScores.SOROS += concentrated ? 10 : 4;
  rawScores.SOROS += stats.avgWinPct >= 6 ? 15 : 6;
  rawScores.SOROS += stats.winRate >= 0.45 && stats.winRate <= 0.75 ? 15 : 5;

  const total = Object.values(rawScores).reduce((acc, score) => acc + score, 0) || 1;
  const ranked = Object.entries(rawScores)
    .map(([name, score]) => ({
      name: name as LegendName,
      pct: toFixed((score / total) * 100, 2),
    }))
    .sort((a, b) => b.pct - a.pct);

  const primary = ranked[0] ?? { name: "LYNCH" as LegendName, pct: 50 };
  const secondary = ranked[1] ?? { name: "BUFFETT" as LegendName, pct: 50 };

  return {
    primary,
    secondary,
    insight: normalizeInsight(
      `Najmocniej przypominasz ${primary.name}, z domieszka stylu ${secondary.name}; kluczowe sa horyzont i zarzadzanie ryzykiem.`,
    ),
  };
}

async function defaultRunAi(
  stats: StrategyDnaStats,
  fallback: { primary: StrategyDnaLegendMatch; secondary: StrategyDnaLegendMatch; insight: string },
): Promise<{ primary: StrategyDnaLegendMatch; secondary: StrategyDnaLegendMatch; insight: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return fallback;
  try {
    const client = new Anthropic({ apiKey });
    const prompt = `Trader stats: holdDays=${stats.avgHoldingDays}, winRate=${stats.winRate}, riskRatio=${stats.riskTolerance}.
Match to: BUFFETT/LYNCH/GREENBLATT/SOROS.
Return JSON: { primary: {name, pct}, secondary: {name, pct}, insight: string (max 20 words) }`;
    const message = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 180,
      temperature: 0,
      messages: [{ role: "user", content: prompt }],
    });
    const firstBlock = message.content[0];
    const text = firstBlock?.type === "text" ? firstBlock.text : "";
    const parsed = parseJsonFromText(text) as
      | {
          primary?: { name?: string; pct?: number };
          secondary?: { name?: string; pct?: number };
          insight?: string;
        }
      | null;

    if (!parsed) return fallback;
    const primaryName = normalizeLegend(parsed.primary?.name ?? "");
    const secondaryName = normalizeLegend(parsed.secondary?.name ?? "");
    if (!primaryName || !secondaryName) return fallback;

    const primaryPct = clamp(Number(parsed.primary?.pct ?? NaN), 0, 100);
    const secondaryPct = clamp(Number(parsed.secondary?.pct ?? NaN), 0, 100);
    const safePrimaryPct = Number.isFinite(primaryPct) ? toFixed(primaryPct, 2) : fallback.primary.pct;
    const safeSecondaryPct = Number.isFinite(secondaryPct) ? toFixed(secondaryPct, 2) : fallback.secondary.pct;

    return {
      primary: { name: primaryName, pct: safePrimaryPct },
      secondary: { name: secondaryName, pct: safeSecondaryPct },
      insight: normalizeInsight(parsed.insight ?? fallback.insight),
    };
  } catch {
    return fallback;
  }
}

export function createStrategyDnaService(customDeps?: Partial<StrategyDnaDeps>) {
  const deps: StrategyDnaDeps = {
    db: customDeps?.db ??
      (({
        paperTrade: prisma.paperTrade,
        company: prisma.company,
      } as unknown) as StrategyDnaDeps["db"]),
    runAi: customDeps?.runAi ?? defaultRunAi,
  };

  async function getStrategyDnaMatch(userId: string): Promise<StrategyDnaResponse> {
    const normalizedUserId = userId.trim();
    if (!normalizedUserId) throw new Error("Missing userId");

    const closedTrades = await deps.db.paperTrade.findMany({
      where: { userId: normalizedUserId, status: "CLOSED" },
      orderBy: { exitAt: "desc" },
      take: 250,
    });

    const validTrades = closedTrades.filter((trade) => trade.status === "CLOSED");
    const hasEnoughData = validTrades.length >= 20;

    const symbolSet = Array.from(new Set(validTrades.map((trade) => trade.ticker.toUpperCase())));
    const companies =
      symbolSet.length > 0
        ? await deps.db.company.findMany({
            where: { symbol: { in: symbolSet } },
            select: { symbol: true, sector: true },
          })
        : [];
    const sectorBySymbol = new Map(companies.map((company) => [company.symbol.toUpperCase(), company.sector || "Unknown"]));

    const wins: number[] = [];
    const losses: number[] = [];
    const holdingDays: number[] = [];
    const sectorFreq = new Map<string, number>();

    for (const trade of validTrades) {
      if (trade.exitAt) {
        const days = Math.max(0, (trade.exitAt.getTime() - trade.entryAt.getTime()) / (1000 * 60 * 60 * 24));
        holdingDays.push(days);
      }
      const pnlPct = Number(trade.pnlPct ?? 0);
      if (pnlPct > 0) wins.push(pnlPct);
      if (pnlPct < 0) losses.push(pnlPct);

      const sector = sectorBySymbol.get(trade.ticker.toUpperCase()) ?? "Unknown";
      sectorFreq.set(sector, (sectorFreq.get(sector) ?? 0) + 1);
    }

    const preferredSectors = Array.from(sectorFreq.entries())
      .sort((a, b) => (b[1] === a[1] ? a[0].localeCompare(b[0]) : b[1] - a[1]))
      .slice(0, 3)
      .map(([sector]) => sector);

    const avgWinPct = toFixed(safeMean(wins), 4);
    const avgLossPct = toFixed(safeMean(losses), 4);
    const stats: StrategyDnaStats = {
      avgHoldingDays: toFixed(safeMean(holdingDays), 4),
      winRate: toFixed(validTrades.length > 0 ? wins.length / validTrades.length : 0, 4),
      avgWinPct,
      avgLossPct,
      preferredSectors,
      riskTolerance: toFixed(avgWinPct > 0 ? Math.abs(avgLossPct) / avgWinPct : 0, 4),
    };

    const heuristic = heuristicMatches(stats);
    const ai = hasEnoughData ? await deps.runAi(stats, heuristic) : heuristic;

    return {
      primary: ai.primary,
      secondary: ai.secondary,
      insight: ai.insight,
      stats,
      hasEnoughData,
    };
  }

  return { getStrategyDnaMatch };
}

let strategyDnaServiceSingleton: ReturnType<typeof createStrategyDnaService> | null = null;

function getStrategyDnaService() {
  if (!strategyDnaServiceSingleton) {
    strategyDnaServiceSingleton = createStrategyDnaService();
  }
  return strategyDnaServiceSingleton;
}

export async function getStrategyDnaMatch(userId: string): Promise<StrategyDnaResponse> {
  return getStrategyDnaService().getStrategyDnaMatch(userId);
}
