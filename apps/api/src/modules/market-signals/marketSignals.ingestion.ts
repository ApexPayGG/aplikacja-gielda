import {
  parseEodhdInsiderActivityPayload,
  parsePolygonDarkPoolPayload,
  parsePolygonOptionsFlowPayload,
  parseSecFilingPayload,
} from "./marketSignals.adapters";
import {
  normalizeMarketSignalTicker,
  parseMarketSignalType,
  validateConfidenceScore,
} from "./marketSignals.service";
import type {
  MarketSignalDto,
  MarketSignalIngestInput,
  MarketSignalIngestResponse,
  MarketSignalIngestionResult,
  MarketSignalProvider,
} from "./marketSignals.types";
import { MARKET_SIGNAL_PROVIDERS } from "./marketSignals.types";

export class InvalidMarketSignalProviderError extends Error {
  constructor(provider: unknown) {
    super(`Invalid market signal provider: ${String(provider)}`);
    this.name = "InvalidMarketSignalProviderError";
  }
}

export type MarketSignalIngestionRepository = {
  ingestSignal(input: MarketSignalIngestInput): Promise<MarketSignalIngestResponse>;
};

type ProviderAdapter = (payload: unknown) => MarketSignalIngestInput[];

export type MarketSignalIngestionServiceDeps = {
  marketSignalService: MarketSignalIngestionRepository;
  logger?: {
    warn?: (message: string, meta?: Record<string, unknown>) => void;
  };
  adapters?: Partial<Record<MarketSignalProvider, ProviderAdapter>>;
};

type MarketSignalIngestionLogger = NonNullable<MarketSignalIngestionServiceDeps["logger"]>;

const DEFAULT_ADAPTERS: Record<MarketSignalProvider, ProviderAdapter> = {
  POLYGON_OPTIONS_FLOW: parsePolygonOptionsFlowPayload,
  POLYGON_DARK_POOL: parsePolygonDarkPoolPayload,
  SEC_FILINGS: parseSecFilingPayload,
  EODHD_INSIDER_ACTIVITY: parseEodhdInsiderActivityPayload,
};

export function parseMarketSignalProvider(raw: unknown): MarketSignalProvider | null {
  const normalized = String(raw ?? "").trim().toUpperCase();
  return MARKET_SIGNAL_PROVIDERS.includes(normalized as MarketSignalProvider)
    ? (normalized as MarketSignalProvider)
    : null;
}

export function buildMarketSignalDedupeKey(input: MarketSignalIngestInput): string {
  return [
    normalizeMarketSignalTicker(input.ticker),
    input.signalType,
    input.source.trim(),
    input.title.trim(),
    input.eventTime ?? "",
  ].join("|");
}

export function validateParsedMarketSignalInput(
  input: MarketSignalIngestInput,
): { ok: true; value: MarketSignalIngestInput } | { ok: false; error: string } {
  const ticker = normalizeMarketSignalTicker(input.ticker ?? "");
  if (!ticker) return { ok: false, error: "ticker is required" };

  const signalType = parseMarketSignalType(input.signalType);
  if (!signalType) {
    return { ok: false, error: "signalType must be a supported institutional signal type" };
  }

  const source = String(input.source ?? "").trim();
  if (!source) return { ok: false, error: "source is required" };

  const title = String(input.title ?? "").trim();
  if (!title) return { ok: false, error: "title is required" };

  const confidence = validateConfidenceScore(input.confidenceScore);
  if (!confidence.ok) return confidence;

  let eventTime: string | undefined;
  if (input.eventTime !== undefined && input.eventTime !== null && input.eventTime !== "") {
    const parsed = new Date(String(input.eventTime));
    if (Number.isNaN(parsed.getTime())) {
      return { ok: false, error: "eventTime must be a valid ISO datetime" };
    }
    eventTime = parsed.toISOString();
  }

  const summaryRaw = input.summary;
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
      rawPayload: input.rawPayload,
      eventTime,
    },
  };
}

export type MarketSignalIngestionService = {
  parseProviderPayload: (provider: MarketSignalProvider, payload: unknown) => MarketSignalIngestInput[];
  ingestProviderPayload: (
    provider: MarketSignalProvider,
    payload: unknown,
  ) => Promise<MarketSignalIngestionResult>;
};

export function createMarketSignalIngestionService(
  deps: MarketSignalIngestionServiceDeps,
): MarketSignalIngestionService {
  const adapters: Record<MarketSignalProvider, ProviderAdapter> = {
    ...DEFAULT_ADAPTERS,
    ...deps.adapters,
  };
  const logger: MarketSignalIngestionLogger = deps.logger ?? {};

  function resolveProvider(provider: MarketSignalProvider): ProviderAdapter {
    const adapter = adapters[provider];
    if (!adapter) {
      throw new InvalidMarketSignalProviderError(provider);
    }
    return adapter;
  }

  function parseProviderPayload(provider: MarketSignalProvider, payload: unknown): MarketSignalIngestInput[] {
    if (!parseMarketSignalProvider(provider)) {
      throw new InvalidMarketSignalProviderError(provider);
    }
    return resolveProvider(provider)(payload);
  }

  async function ingestProviderPayload(
    provider: MarketSignalProvider,
    payload: unknown,
  ): Promise<MarketSignalIngestionResult> {
    if (!parseMarketSignalProvider(provider)) {
      throw new InvalidMarketSignalProviderError(provider);
    }

    const parsed = parseProviderPayload(provider, payload);
    const parsedCount = parsed.length;
    const seen = new Set<string>();
    const validated: MarketSignalIngestInput[] = [];

    for (const item of parsed) {
      const dedupeKey = buildMarketSignalDedupeKey(item);
      if (seen.has(dedupeKey)) {
        continue;
      }
      seen.add(dedupeKey);

      const validation = validateParsedMarketSignalInput(item);
      if (!validation.ok) {
        logger.warn?.("Rejected parsed market signal", {
          provider,
          error: validation.error,
          ticker: item.ticker,
          signalType: item.signalType,
        });
        continue;
      }

      validated.push(validation.value);
    }

    const signals: MarketSignalDto[] = [];
    for (const item of validated) {
      const saved = await deps.marketSignalService.ingestSignal(item);
      signals.push(saved.signal);
    }

    const savedCount = signals.length;

    return {
      provider,
      parsedCount,
      savedCount,
      rejectedCount: parsedCount - savedCount,
      signals,
    };
  }

  return {
    parseProviderPayload,
    ingestProviderPayload,
  };
}
