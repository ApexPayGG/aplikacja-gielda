import type { MarketSignal, Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "../../db";
import {
  MARKET_SIGNAL_TYPES,
  type MarketSignalDto,
  type MarketSignalIngestInput,
  type MarketSignalIngestResponse,
  type MarketSignalsListResponse,
  type MarketSignalsSummary,
  type MarketSignalType,
  type SummarizableMarketSignal,
} from "./marketSignals.types";

export const DEFAULT_LOOKBACK_DAYS = 30;
export const MAX_LOOKBACK_DAYS = 365;

const MS_PER_DAY = 86_400_000;

type MarketSignalsDb = Pick<PrismaClient, "marketSignal">;

export type MarketSignalsServiceDeps = {
  db: MarketSignalsDb;
  now: () => Date;
};

export function normalizeMarketSignalTicker(ticker: string): string {
  return ticker.trim().toUpperCase().slice(0, 20);
}

export function parseMarketSignalType(raw: unknown): MarketSignalType | null {
  const normalized = String(raw ?? "").trim().toUpperCase();
  return MARKET_SIGNAL_TYPES.includes(normalized as MarketSignalType)
    ? (normalized as MarketSignalType)
    : null;
}

export function clampLookbackDays(raw: number | undefined): number {
  if (raw === undefined || !Number.isFinite(raw)) return DEFAULT_LOOKBACK_DAYS;
  return Math.min(MAX_LOOKBACK_DAYS, Math.max(1, Math.floor(raw)));
}

export function validateConfidenceScore(raw: unknown): { ok: true; value: number } | { ok: false; error: string } {
  if (raw === undefined || raw === null || raw === "") {
    return { ok: false, error: "confidenceScore is required" };
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    return { ok: false, error: "confidenceScore must be a number" };
  }
  const rounded = Math.round(value);
  if (rounded < 0 || rounded > 100) {
    return { ok: false, error: "confidenceScore must be between 0 and 100" };
  }
  return { ok: true, value: rounded };
}

export function parseMarketSignalIngestInput(
  body: Record<string, unknown>,
  now: Date,
): { ok: true; value: MarketSignalIngestInput } | { ok: false; error: string } {
  const ticker = normalizeMarketSignalTicker(String(body.ticker ?? ""));
  if (!ticker) return { ok: false, error: "ticker is required" };

  const signalType = parseMarketSignalType(body.signalType);
  if (!signalType) {
    return { ok: false, error: "signalType must be a supported institutional signal type" };
  }

  const source = String(body.source ?? "").trim();
  if (!source) return { ok: false, error: "source is required" };

  const title = String(body.title ?? "").trim();
  if (!title) return { ok: false, error: "title is required" };

  const confidence = validateConfidenceScore(body.confidenceScore);
  if (!confidence.ok) return confidence;

  let eventTime = now.toISOString();
  if (body.eventTime !== undefined && body.eventTime !== null && body.eventTime !== "") {
    const parsed = new Date(String(body.eventTime));
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "eventTime must be a valid ISO datetime" };
    }
    eventTime = parsed.toISOString();
  }

  const summaryRaw = body.summary;
  const summary =
    summaryRaw === undefined || summaryRaw === null ? undefined : String(summaryRaw).trim() || undefined;

  return {
    ok: true,
    value: {
      ticker,
      signalType,
      source,
      confidenceScore: confidence.value,
      title,
      summary,
      rawPayload: body.rawPayload,
      eventTime,
    },
  };
}

function emptyByType(): Partial<Record<MarketSignalType, number>> {
  return {};
}

export function summarizeMarketSignals(signals: SummarizableMarketSignal[]): MarketSignalsSummary {
  const byType = emptyByType();
  let confidenceTotal = 0;

  for (const signal of signals) {
    byType[signal.signalType] = (byType[signal.signalType] ?? 0) + 1;
    confidenceTotal += signal.confidenceScore;
  }

  const typeStats = MARKET_SIGNAL_TYPES.map((signalType) => {
    const typedSignals = signals.filter((signal) => signal.signalType === signalType);
    if (typedSignals.length === 0) return null;
    const averageConfidence =
      typedSignals.reduce((sum, signal) => sum + signal.confidenceScore, 0) / typedSignals.length;
    return { signalType, count: typedSignals.length, averageConfidence };
  }).filter((entry): entry is NonNullable<typeof entry> => entry != null);

  const strongestSignalType =
    typeStats.sort((a, b) => {
      if (b.averageConfidence !== a.averageConfidence) {
        return b.averageConfidence - a.averageConfidence;
      }
      return b.count - a.count;
    })[0]?.signalType ?? null;

  const darkPoolHighConfidence = signals.filter(
    (signal) => signal.signalType === "DARK_POOL" && signal.confidenceScore >= 75,
  );
  const whaleSignals = signals.filter(
    (signal) => signal.signalType === "WHALE_ACCUMULATION" && signal.confidenceScore >= 80,
  );
  const optionsFlowSignals = signals.filter((signal) => signal.signalType === "OPTIONS_FLOW");
  const darkPoolSignals = signals.filter((signal) => signal.signalType === "DARK_POOL");
  const comboSignals = [...optionsFlowSignals, ...darkPoolSignals];
  const comboAverageConfidence =
    comboSignals.length > 0
      ? comboSignals.reduce((sum, signal) => sum + signal.confidenceScore, 0) / comboSignals.length
      : 0;

  const whaleAccumulationDetected =
    darkPoolHighConfidence.length >= 2 ||
    whaleSignals.length >= 1 ||
    (optionsFlowSignals.length > 0 &&
      darkPoolSignals.length > 0 &&
      comboAverageConfidence >= 70);

  return {
    total: signals.length,
    byType,
    strongestSignalType,
    averageConfidenceScore:
      signals.length > 0 ? Math.round((confidenceTotal / signals.length) * 100) / 100 : 0,
    whaleAccumulationDetected,
  };
}

function toDto(row: MarketSignal): MarketSignalDto {
  return {
    id: row.id,
    ticker: row.ticker,
    signalType: row.signalType as MarketSignalType,
    source: row.source,
    confidenceScore: row.confidenceScore,
    title: row.title,
    summary: row.summary,
    rawPayload: row.rawPayload ?? null,
    eventTime: row.eventTime.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class MarketSignalsService {
  constructor(
    private readonly deps: MarketSignalsServiceDeps = {
      db: defaultPrisma,
      now: () => new Date(),
    },
  ) {}

  async listSignals(input: {
    ticker: string;
    lookbackDays?: number;
    signalType?: MarketSignalType;
    minConfidence?: number;
  }): Promise<MarketSignalsListResponse> {
    const ticker = normalizeMarketSignalTicker(input.ticker);
    const lookbackDays = clampLookbackDays(input.lookbackDays);
    const minConfidence = Math.max(0, Math.min(100, Math.round(input.minConfidence ?? 0)));
    const since = new Date(this.deps.now().getTime() - lookbackDays * MS_PER_DAY);

    const where: Prisma.MarketSignalWhereInput = {
      ticker,
      eventTime: { gte: since },
      confidenceScore: { gte: minConfidence },
      ...(input.signalType ? { signalType: input.signalType } : {}),
    };

    const rows = await this.deps.db.marketSignal.findMany({
      where,
      orderBy: [{ eventTime: "desc" }, { confidenceScore: "desc" }],
    });

    const signals = rows.map(toDto);
    return {
      ticker,
      lookbackDays,
      signals,
      summary: summarizeMarketSignals(signals),
    };
  }

  async ingestSignal(input: MarketSignalIngestInput): Promise<MarketSignalIngestResponse> {
    const created = await this.deps.db.marketSignal.create({
      data: {
        ticker: normalizeMarketSignalTicker(input.ticker),
        signalType: input.signalType,
        source: input.source.trim(),
        confidenceScore: input.confidenceScore,
        title: input.title.trim(),
        summary: input.summary?.trim() || null,
        rawPayload:
          input.rawPayload === undefined
            ? undefined
            : (input.rawPayload as Prisma.InputJsonValue),
        eventTime: new Date(input.eventTime ?? this.deps.now().toISOString()),
      },
    });

    return {
      saved: true,
      signal: toDto(created),
    };
  }
}

export const marketSignalsService = new MarketSignalsService();
