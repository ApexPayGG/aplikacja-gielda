import Anthropic from "@anthropic-ai/sdk";
import type { PrismaClient } from "@prisma/client";
import process from "node:process";
import { cacheJsonGet, cacheJsonSet } from "../../cache/jsonCache";
import { REDIS_TTL_SEC, redisKeys } from "../../config/redis";
import type { UserTier } from "../../services/aiBriefRateLimit";
import {
  logAiCallFromAnthropicResponse,
  type AiCallTelemetry,
} from "../../services/aiCostTelemetry";
import {
  enforcePremiumAnalysisDailyLimit,
  type PremiumAnalysisUsageLimitResult,
} from "../../services/premiumAnalysisUsageLimit";
import { SingleFlightTimeoutError, withSingleFlight } from "../../utils/singleFlight";
import {
  buildStockAIDataSnapshot,
  createSnapshotHash,
  STOCK_AI_DATA_SNAPSHOT_VERSION,
  type StockAIDataSnapshot,
} from "./dataSnapshot";
import { buildFallbackPremiumAnalysisContract } from "./premiumAnalysisFallback";
import {
  buildPremiumAnalysisRepairPrompt,
  buildPremiumAnalysisSystemPrompt,
  buildPremiumAnalysisUserPrompt,
} from "./premiumAnalysisPrompts";
import {
  type PremiumAnalysisContract,
  validatePremiumAnalysisContract,
} from "./premiumAnalysisContract";
import type { ZodError, ZodIssue } from "zod";
import { normalizePremiumAnalysisCandidate } from "./premiumAnalysisCandidateNormalizer";
import { resolvePremiumAnalysisModel } from "./premiumAnalysisModelTasks";

export const ANALYSIS_MAX_TOKENS = 2800;
export const ANALYSIS_REPAIR_MIN_TIME_BUDGET_MS = 20_000;
export const ANALYSIS_TOTAL_SOFT_BUDGET_MS = 75_000;
export const ANALYSIS_SINGLE_CALL_WARN_MS = 45_000;
/** Max first-call latency before skipping repair (fast failures only). */
export const ANALYSIS_REPAIR_MAX_FIRST_CALL_LATENCY_MS = 20_000;
export const PREMIUM_ANALYSIS_SINGLE_FLIGHT_LOCK_TTL_SEC = 120;
export const PREMIUM_ANALYSIS_SINGLE_FLIGHT_WAIT_MS = 750;
export const PREMIUM_ANALYSIS_SINGLE_FLIGHT_MAX_WAIT_MS = 70_000;
const ANALYSIS_TEMPERATURE = 0.2;

export type AnthropicContractCallResult = {
  contract: PremiumAnalysisContract | null;
  raw: string;
  model: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  stopReason?: string | null;
};

export type PremiumAnalysisCacheStatus = "hit" | "miss" | "fallback";

export type PremiumAnalysisProviderName = "anthropic" | "fallback" | "legacy";

export type PremiumAnalysisProviderMeta = {
  name: PremiumAnalysisProviderName;
  model: string | null;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  retryCount?: number;
};

/** Redis cache envelope schema (v1). */
export const PREMIUM_ANALYSIS_CACHE_ENVELOPE_SCHEMA_VERSION = 1 as const;

export type PremiumAnalysisCacheEnvelopeSourceStatus = "miss" | "fallback";

export type PremiumAnalysisCacheEnvelope = {
  schemaVersion: typeof PREMIUM_ANALYSIS_CACHE_ENVELOPE_SCHEMA_VERSION;
  contract: PremiumAnalysisContract;
  provider: PremiumAnalysisProviderMeta;
  /** cacheStatus at write time (fresh generation path only). */
  sourceCacheStatus: PremiumAnalysisCacheEnvelopeSourceStatus;
  cachedAt: string;
};

export type ParsedPremiumAnalysisCacheEntry = {
  contract: PremiumAnalysisContract;
  provider: PremiumAnalysisProviderMeta;
  sourceCacheStatus: PremiumAnalysisCacheEnvelopeSourceStatus;
  cachedAt: string;
};

export type PremiumAnalysisDailyUsageMeta = {
  limit: number;
  remaining: number;
  resetIn: number;
  tier: UserTier;
};

export type PremiumAnalysisBundle = {
  contract: PremiumAnalysisContract;
  snapshotHash: string;
  snapshotVersion: string;
  generatedAt: string;
  cacheStatus: PremiumAnalysisCacheStatus;
  provider: PremiumAnalysisProviderMeta;
  /** Present on fresh generation paths after daily limit enforcement (not cache hits). */
  usage?: PremiumAnalysisDailyUsageMeta;
};

export type PremiumAnalysisOrchestratorDeps = {
  loadCachedEntry?: (cacheKey: string) => Promise<ParsedPremiumAnalysisCacheEntry | null>;
  readCachedBundleAfterWait?: (
    cacheKey: string,
    snapshotHash: string,
  ) => Promise<PremiumAnalysisBundle | null>;
  enforceDailyLimit?: (
    input: Parameters<typeof enforcePremiumAnalysisDailyLimit>[0],
  ) => Promise<PremiumAnalysisUsageLimitResult>;
  hasAnthropicKey?: () => boolean;
  callAnthropicForContract?: (
    snapshot: StockAIDataSnapshot,
    language: string,
    repair?: { validationSummary: string; priorRaw: string },
    telemetry?: Partial<AiCallTelemetry>,
    snapshotHash?: string | null,
  ) => Promise<AnthropicContractCallResult>;
  cacheJsonSet?: (
    key: string,
    value: unknown,
    ttlSec: number,
  ) => Promise<void>;
  buildSnapshot?: typeof buildStockAIDataSnapshot;
};

export type BuildPremiumAnalysisBundleInput = {
  symbol: string;
  prisma: PrismaClient;
  userId?: string | null;
  plan?: string | null;
  clientIp?: string | null;
  accessState?: string | null;
  canUseProduct?: boolean | null;
  language?: string;
  telemetry?: Partial<AiCallTelemetry>;
  deps?: PremiumAnalysisOrchestratorDeps;
  /** Test-only: bypass Prisma snapshot build */
  snapshotOverride?: StockAIDataSnapshot;
};

export class PremiumAnalysisUsageLimitExceededError extends Error {
  readonly code = "PREMIUM_ANALYSIS_DAILY_LIMIT";
  readonly statusCode = 429;

  constructor(
    message: string,
    public readonly tier: UserTier,
    public readonly limit: number,
    public readonly resetIn: number,
  ) {
    super(message);
    this.name = "PremiumAnalysisUsageLimitExceededError";
  }
}

function parseJsonObject(raw: string): unknown | null {
  const text = String(raw ?? "").trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as unknown;
  } catch {
    return null;
  }
}

export type PremiumAnalysisValidationIssueDiagnostic = {
  path: string;
  code: string;
  message: string;
  expected?: unknown;
  received?: unknown;
};

export type PremiumAnalysisValidationFailureSummary = {
  validationIssues: PremiumAnalysisValidationIssueDiagnostic[];
  issueCount: number;
};

type PremiumAnalysisLlmDiagnosticEvent =
  | "premium_analysis_llm_empty_response"
  | "premium_analysis_llm_parse_failed"
  | "premium_analysis_llm_validation_failed"
  | "premium_analysis_llm_normalized_contract"
  | "premium_analysis_cache_served";

function formatZodIssuePath(path: PropertyKey[]): string {
  return path.map((segment) => String(segment)).join(".");
}

function zodIssueExtras(issue: ZodIssue): Pick<
  PremiumAnalysisValidationIssueDiagnostic,
  "expected" | "received"
> {
  const extras: Pick<PremiumAnalysisValidationIssueDiagnostic, "expected" | "received"> = {};
  if ("expected" in issue) extras.expected = issue.expected;
  if ("received" in issue) extras.received = issue.received;
  return extras;
}

export function extractValidationIssues(
  error: ZodError,
  maxIssues = 24,
): PremiumAnalysisValidationIssueDiagnostic[] {
  return error.issues.slice(0, maxIssues).map((issue) => ({
    path: formatZodIssuePath(issue.path),
    code: issue.code,
    message: issue.message,
    ...zodIssueExtras(issue),
  }));
}

export function summarizePremiumAnalysisValidationFailure(
  error: ZodError,
  maxIssues = 24,
): PremiumAnalysisValidationFailureSummary {
  return {
    validationIssues: extractValidationIssues(error, maxIssues),
    issueCount: error.issues.length,
  };
}

export function extractParsedTopLevelKeys(parsed: unknown): string[] | null {
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  return Object.keys(parsed as Record<string, unknown>).sort();
}

export function isPremiumAnalysisDebugRawEnabled(): boolean {
  return process.env.PREMIUM_ANALYSIS_DEBUG_RAW === "1";
}

export function buildPremiumAnalysisRawPreview(raw: string, maxLen = 1000): string | undefined {
  if (!isPremiumAnalysisDebugRawEnabled()) return undefined;
  const text = String(raw ?? "");
  if (!text) return undefined;
  return text.length <= maxLen ? text : text.slice(0, maxLen);
}

function formatZodSummary(error: ZodError): string {
  return extractValidationIssues(error, 12)
    .map((issue) => `${issue.path}: ${issue.message}`)
    .join("; ");
}

function logPremiumAnalysisLlmDiagnostic(
  event: PremiumAnalysisLlmDiagnosticEvent,
  payload: Record<string, unknown>,
): void {
  console.info(JSON.stringify({ event, ...payload }));
}

type PremiumAnalysisLlmCallContext = {
  symbol: string;
  language: string;
  model: string;
  repair: boolean;
  latencyMs: number;
  stopReason: string | null;
  inputTokens?: number;
  outputTokens?: number;
  snapshotHash?: string | null;
};

function buildPremiumAnalysisLlmDiagnosticBase(
  ctx: PremiumAnalysisLlmCallContext,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    symbol: ctx.symbol,
    language: ctx.language,
    model: ctx.model,
    repair: ctx.repair,
    latencyMs: ctx.latencyMs,
    stopReason: ctx.stopReason,
    snapshotVersion: STOCK_AI_DATA_SNAPSHOT_VERSION,
  };
  if (ctx.inputTokens != null) base.inputTokens = ctx.inputTokens;
  if (ctx.outputTokens != null) base.outputTokens = ctx.outputTokens;
  if (ctx.snapshotHash) base.snapshotHash = ctx.snapshotHash;
  return base;
}

function logPremiumAnalysisNormalizedSuccess(
  ctx: PremiumAnalysisLlmCallContext,
  changedFields: string[],
  rawLength: number,
): void {
  if (!changedFields.length) return;
  logPremiumAnalysisLlmDiagnostic("premium_analysis_llm_normalized_contract", {
    ...buildPremiumAnalysisLlmDiagnosticBase(ctx),
    rawLength,
    changedFields,
  });
}

function logPremiumAnalysisContractFailure(
  ctx: PremiumAnalysisLlmCallContext,
  raw: string,
  blockType: string | undefined,
  parsed: unknown,
  normalized: unknown,
  validated: ReturnType<typeof validatePremiumAnalysisContract> | null,
): void {
  const rawLength = raw.length;
  const rawPreview = buildPremiumAnalysisRawPreview(raw);
  const base = buildPremiumAnalysisLlmDiagnosticBase(ctx);

  const hasTextBlock = blockType === "text";
  if (!hasTextBlock || !raw.trim()) {
    logPremiumAnalysisLlmDiagnostic("premium_analysis_llm_empty_response", {
      ...base,
      rawLength,
      contentBlockType: blockType ?? "missing",
      ...(rawPreview ? { rawPreview } : {}),
    });
    return;
  }

  if (parsed == null) {
    logPremiumAnalysisLlmDiagnostic("premium_analysis_llm_parse_failed", {
      ...base,
      rawLength,
      ...(rawPreview ? { rawPreview } : {}),
    });
    return;
  }

  if (validated && !validated.success) {
    const summary = summarizePremiumAnalysisValidationFailure(validated.error);
    logPremiumAnalysisLlmDiagnostic("premium_analysis_llm_validation_failed", {
      ...base,
      rawLength,
      parsedTopLevelKeys: extractParsedTopLevelKeys(parsed),
      normalizedTopLevelKeys: extractParsedTopLevelKeys(normalized),
      validationIssues: summary.validationIssues,
      issueCount: summary.issueCount,
      ...(rawPreview ? { rawPreview } : {}),
    });
  }
}

function hasAnthropicKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

export function likelyTruncatedAnthropicResponse(
  result: AnthropicContractCallResult,
  maxTokens: number = ANALYSIS_MAX_TOKENS,
): boolean {
  if (result.stopReason === "max_tokens") return true;
  if (result.outputTokens != null && result.outputTokens >= maxTokens) return true;
  if (!result.contract && (result.outputTokens ?? 0) >= Math.floor(maxTokens * 0.95)) return true;
  if (!result.contract && result.raw.length >= maxTokens * 3) return true;
  return false;
}

export function shouldAttemptPremiumAnalysisRepair(
  first: AnthropicContractCallResult,
  anthropicStartedAtMs: number,
  nowMs: number = Date.now(),
): boolean {
  if (first.contract) return false;
  if (likelyTruncatedAnthropicResponse(first)) return false;
  if (first.latencyMs >= ANALYSIS_REPAIR_MAX_FIRST_CALL_LATENCY_MS) return false;
  if (first.latencyMs >= ANALYSIS_SINGLE_CALL_WARN_MS) return false;
  const elapsed = nowMs - anthropicStartedAtMs;
  const repairDeadline = ANALYSIS_TOTAL_SOFT_BUDGET_MS - ANALYSIS_REPAIR_MIN_TIME_BUDGET_MS;
  if (elapsed >= repairDeadline) return false;
  return true;
}

function normalizeStoredProvider(raw: unknown): PremiumAnalysisProviderMeta {
  if (raw == null || typeof raw !== "object") {
    return { name: "legacy", model: null };
  }
  const provider = raw as Record<string, unknown>;
  const name = provider.name;
  if (name === "anthropic" || name === "fallback" || name === "legacy") {
    return {
      name,
      model: typeof provider.model === "string" || provider.model === null ? provider.model : null,
      latencyMs: typeof provider.latencyMs === "number" ? provider.latencyMs : undefined,
      inputTokens: typeof provider.inputTokens === "number" ? provider.inputTokens : undefined,
      outputTokens: typeof provider.outputTokens === "number" ? provider.outputTokens : undefined,
      retryCount: typeof provider.retryCount === "number" ? provider.retryCount : undefined,
    };
  }
  return { name: "legacy", model: null };
}

function isPremiumAnalysisCacheEnvelope(value: unknown): value is PremiumAnalysisCacheEnvelope {
  if (value == null || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    record.schemaVersion === PREMIUM_ANALYSIS_CACHE_ENVELOPE_SCHEMA_VERSION &&
    record.contract != null &&
    typeof record === "object"
  );
}

/** Parse Redis cache payload: envelope v1 or legacy bare contract. */
export function parsePremiumAnalysisCacheEntry(cached: unknown): ParsedPremiumAnalysisCacheEntry | null {
  if (cached == null) return null;

  if (isPremiumAnalysisCacheEnvelope(cached)) {
    const contractResult = validatePremiumAnalysisContract(cached.contract);
    if (!contractResult.success) return null;
    const sourceCacheStatus: PremiumAnalysisCacheEnvelopeSourceStatus =
      cached.sourceCacheStatus === "fallback" ? "fallback" : "miss";
    const cachedAt =
      typeof cached.cachedAt === "string" && cached.cachedAt.trim()
        ? cached.cachedAt
        : contractResult.data.generatedAt;
    return {
      contract: contractResult.data,
      provider: normalizeStoredProvider(cached.provider),
      sourceCacheStatus,
      cachedAt,
    };
  }

  const legacyResult = validatePremiumAnalysisContract(cached);
  if (!legacyResult.success) return null;
  return {
    contract: legacyResult.data,
    provider: { name: "legacy", model: null },
    sourceCacheStatus: "miss",
    cachedAt: legacyResult.data.generatedAt,
  };
}

export function readValidatedPremiumAnalysisCache(cached: unknown): PremiumAnalysisContract | null {
  return parsePremiumAnalysisCacheEntry(cached)?.contract ?? null;
}

export function buildPremiumAnalysisCacheEnvelope(input: {
  contract: PremiumAnalysisContract;
  provider: PremiumAnalysisProviderMeta;
  sourceCacheStatus: PremiumAnalysisCacheEnvelopeSourceStatus;
  cachedAt?: string;
}): PremiumAnalysisCacheEnvelope {
  return {
    schemaVersion: PREMIUM_ANALYSIS_CACHE_ENVELOPE_SCHEMA_VERSION,
    contract: input.contract,
    provider: input.provider,
    sourceCacheStatus: input.sourceCacheStatus,
    cachedAt: input.cachedAt ?? new Date().toISOString(),
  };
}

async function loadCachedEntryDefault(cacheKey: string): Promise<ParsedPremiumAnalysisCacheEntry | null> {
  const cached = await cacheJsonGet<unknown>(cacheKey);
  if (cached == null) return null;
  return parsePremiumAnalysisCacheEntry(cached);
}

function logPremiumAnalysisCacheServed(input: {
  symbol: string;
  language: string;
  snapshotHash: string;
  provider: PremiumAnalysisProviderMeta;
  sourceCacheStatus: PremiumAnalysisCacheEnvelopeSourceStatus;
}): void {
  logPremiumAnalysisLlmDiagnostic("premium_analysis_cache_served", {
    symbol: input.symbol,
    language: input.language,
    snapshotHash: input.snapshotHash,
    providerName: input.provider.name,
    sourceCacheStatus: input.sourceCacheStatus,
  });
}

export function buildPremiumAnalysisCacheHitBundle(
  entry: ParsedPremiumAnalysisCacheEntry,
  snapshotHash: string,
): PremiumAnalysisBundle {
  return {
    contract: entry.contract,
    snapshotHash,
    snapshotVersion: STOCK_AI_DATA_SNAPSHOT_VERSION,
    generatedAt: entry.contract.generatedAt,
    cacheStatus: "hit",
    provider: entry.provider,
  };
}

async function readCachedBundleAfterWaitWithDeps(
  cacheKey: string,
  snapshotHash: string,
  deps: Required<Pick<PremiumAnalysisOrchestratorDeps, "loadCachedEntry">> &
    Pick<PremiumAnalysisOrchestratorDeps, "readCachedBundleAfterWait">,
): Promise<PremiumAnalysisBundle | null> {
  if (deps.readCachedBundleAfterWait) {
    return deps.readCachedBundleAfterWait(cacheKey, snapshotHash);
  }
  const entry = await deps.loadCachedEntry(cacheKey);
  if (!entry) return null;
  return buildPremiumAnalysisCacheHitBundle(entry, snapshotHash);
}

function resolvePremiumAnalysisOrchestratorDeps(
  deps?: PremiumAnalysisOrchestratorDeps,
): Required<
  Pick<
    PremiumAnalysisOrchestratorDeps,
    | "loadCachedEntry"
    | "enforceDailyLimit"
    | "hasAnthropicKey"
    | "callAnthropicForContract"
    | "cacheJsonSet"
  >
> &
  Pick<PremiumAnalysisOrchestratorDeps, "readCachedBundleAfterWait" | "buildSnapshot"> {
  return {
    loadCachedEntry: deps?.loadCachedEntry ?? loadCachedEntryDefault,
    readCachedBundleAfterWait: deps?.readCachedBundleAfterWait,
    enforceDailyLimit: deps?.enforceDailyLimit ?? enforcePremiumAnalysisDailyLimit,
    hasAnthropicKey: deps?.hasAnthropicKey ?? hasAnthropicKey,
    callAnthropicForContract: deps?.callAnthropicForContract ?? callAnthropicForContract,
    cacheJsonSet: deps?.cacheJsonSet ?? cacheJsonSet,
    buildSnapshot: deps?.buildSnapshot,
  };
}

function buildPremiumAnalysisLockKey(
  ticker: string,
  snapshotHash: string,
  language: string,
): string {
  return `singleflight:premium:analysis:${ticker}:${snapshotHash}:${language}`;
}

/** Waiter timeout: deterministic fallback without Anthropic or cache write. */
export function buildPremiumAnalysisSingleFlightTimeoutBundle(
  snapshot: StockAIDataSnapshot,
  snapshotHash: string,
): PremiumAnalysisBundle {
  const contract = buildFallbackPremiumAnalysisContract(snapshot);
  const fallbackCheck = validatePremiumAnalysisContract(contract);
  if (!fallbackCheck.success) {
    throw new Error(
      `Fallback premium analysis contract invalid: ${formatZodSummary(fallbackCheck.error)}`,
    );
  }
  return {
    contract,
    snapshotHash,
    snapshotVersion: STOCK_AI_DATA_SNAPSHOT_VERSION,
    generatedAt: contract.generatedAt,
    cacheStatus: "fallback",
    provider: { name: "fallback", model: null, retryCount: 0 },
  };
}

type RunPremiumAnalysisFreshGenerationInput = {
  snapshot: StockAIDataSnapshot;
  snapshotHash: string;
  cacheKey: string;
  language: string;
  plan?: string | null;
  userId?: string | null;
  clientIp?: string | null;
  accessState?: string | null;
  canUseProduct?: boolean | null;
  telemetry?: Partial<AiCallTelemetry>;
  deps?: PremiumAnalysisOrchestratorDeps;
};

export async function runPremiumAnalysisFreshGeneration(
  input: RunPremiumAnalysisFreshGenerationInput,
): Promise<PremiumAnalysisBundle> {
  const { snapshot, snapshotHash, cacheKey, language } = input;
  const deps = resolvePremiumAnalysisOrchestratorDeps(input.deps);

  const leaderCacheHit = await readCachedBundleAfterWaitWithDeps(cacheKey, snapshotHash, deps);
  if (leaderCacheHit) return leaderCacheHit;

  let retryCount = 0;
  let provider: PremiumAnalysisProviderMeta = {
    name: "fallback",
    model: null,
  };
  let contract: PremiumAnalysisContract | null = null;
  let usageMeta: PremiumAnalysisDailyUsageMeta | undefined;

  if (deps.hasAnthropicKey()) {
    const usage = await deps.enforceDailyLimit({
      tier: input.plan ?? "FREE",
      userId: input.userId ?? null,
      clientIp: input.clientIp ?? null,
      accessState: input.accessState ?? null,
      canUseProduct: input.canUseProduct ?? null,
    });
    if (!usage.allowed) {
      throw new PremiumAnalysisUsageLimitExceededError(
        "Daily limit of fresh Premium Analysis generations reached.",
        usage.tier,
        usage.limit,
        usage.resetIn,
      );
    }
    usageMeta = {
      limit: usage.limit,
      remaining: usage.remaining,
      resetIn: usage.resetIn,
      tier: usage.tier,
    };

    const anthropicStartedAt = Date.now();
    try {
      const first = await deps.callAnthropicForContract(
        snapshot,
        language,
        undefined,
        input.telemetry,
        input.snapshotHash,
      );
      contract = first.contract;
      provider = {
        name: contract ? "anthropic" : "fallback",
        model: first.model,
        latencyMs: first.latencyMs,
        inputTokens: first.inputTokens,
        outputTokens: first.outputTokens,
        retryCount: 0,
      };

      if (!contract && shouldAttemptPremiumAnalysisRepair(first, anthropicStartedAt)) {
        const validationSummary = "JSON parse failed or schema validation failed on first attempt.";
        retryCount = 1;
        const second = await deps.callAnthropicForContract(
          snapshot,
          language,
          { validationSummary, priorRaw: first.raw || "{}" },
          input.telemetry,
          input.snapshotHash,
        );
        contract = second.contract;
        const useAnthropic = contract != null && !likelyTruncatedAnthropicResponse(second);
        if (!useAnthropic) contract = null;
        provider = {
          name: useAnthropic ? "anthropic" : "fallback",
          model: second.model,
          latencyMs: (provider.latencyMs ?? 0) + second.latencyMs,
          inputTokens: (provider.inputTokens ?? 0) + (second.inputTokens ?? 0),
          outputTokens: (provider.outputTokens ?? 0) + (second.outputTokens ?? 0),
          retryCount: 1,
        };
      } else if (contract) {
        provider = { ...provider, name: "anthropic" };
      }
    } catch (error) {
      if (error instanceof PremiumAnalysisUsageLimitExceededError) throw error;
      contract = null;
      provider = { name: "fallback", model: provider.model, retryCount };
    }
  }

  let cacheStatus: PremiumAnalysisCacheStatus = "miss";

  if (!contract) {
    contract = buildFallbackPremiumAnalysisContract(snapshot);
    const fallbackCheck = validatePremiumAnalysisContract(contract);
    if (!fallbackCheck.success) {
      throw new Error(
        `Fallback premium analysis contract invalid: ${formatZodSummary(fallbackCheck.error)}`,
      );
    }
    cacheStatus = "fallback";
    provider = {
      name: "fallback",
      model: provider.model,
      latencyMs: provider.latencyMs,
      inputTokens: provider.inputTokens,
      outputTokens: provider.outputTokens,
      retryCount,
    };
  } else {
    const check = validatePremiumAnalysisContract(contract);
    if (!check.success) {
      contract = buildFallbackPremiumAnalysisContract(snapshot);
      cacheStatus = "fallback";
      provider = {
        name: "fallback",
        model: provider.model,
        latencyMs: provider.latencyMs,
        inputTokens: provider.inputTokens,
        outputTokens: provider.outputTokens,
        retryCount,
      };
    }
  }

  const envelope = buildPremiumAnalysisCacheEnvelope({
    contract,
    provider,
    sourceCacheStatus: cacheStatus === "fallback" ? "fallback" : "miss",
  });
  await deps.cacheJsonSet(cacheKey, envelope, REDIS_TTL_SEC.PREMIUM_ANALYSIS_BUNDLE);

  return {
    contract,
    snapshotHash,
    snapshotVersion: STOCK_AI_DATA_SNAPSHOT_VERSION,
    generatedAt: contract.generatedAt,
    cacheStatus,
    provider,
    usage: usageMeta,
  };
}

async function callAnthropicForContract(
  snapshot: Awaited<ReturnType<typeof buildStockAIDataSnapshot>>,
  language: string,
  repair?: { validationSummary: string; priorRaw: string },
  telemetry?: Partial<AiCallTelemetry>,
  snapshotHash?: string | null,
): Promise<AnthropicContractCallResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    return {
      contract: null,
      raw: "",
      model: resolvePremiumAnalysisModel("executive_verdict"),
      latencyMs: 0,
    };
  }

  const model = resolvePremiumAnalysisModel("executive_verdict");
  const startedAt = Date.now();
  const client = new Anthropic({ apiKey });
  const userContent = repair
    ? buildPremiumAnalysisRepairPrompt(snapshot, repair.validationSummary, repair.priorRaw, language)
    : buildPremiumAnalysisUserPrompt(snapshot, language);

  const response = await client.messages.create({
    model,
    max_tokens: ANALYSIS_MAX_TOKENS,
    temperature: ANALYSIS_TEMPERATURE,
    system: buildPremiumAnalysisSystemPrompt(),
    messages: [{ role: "user", content: userContent }],
  });

  logAiCallFromAnthropicResponse(
    {
      endpoint: telemetry?.endpoint ?? "/api/premium/analysis",
      plan: telemetry?.plan ?? "unknown",
      symbol: telemetry?.symbol ?? snapshot.symbol,
      lang: telemetry?.lang ?? language,
      userId: telemetry?.userId ?? null,
      cacheHit: false,
      meta: { bundle: "premium_analysis", repair: Boolean(repair) },
      ...telemetry,
    },
    model,
    startedAt,
    response.usage,
  );

  const block = response.content[0];
  const blockType = block?.type;
  const raw = block && block.type === "text" ? block.text : "";
  const parsed = parseJsonObject(raw);
  const normalizedResult =
    parsed != null ? normalizePremiumAnalysisCandidate(parsed, snapshot) : { candidate: null, changedFields: [] };
  const normalized = normalizedResult.candidate;
  const validated =
    normalized != null ? validatePremiumAnalysisContract(normalized) : null;
  const contract = validated?.success ? validated.data : null;

  const stopReason =
    "stop_reason" in response && typeof response.stop_reason === "string"
      ? response.stop_reason
      : null;

  const latencyMs = Date.now() - startedAt;
  const diagnosticCtx: PremiumAnalysisLlmCallContext = {
    symbol: telemetry?.symbol ?? snapshot.symbol,
    language,
    model,
    repair: Boolean(repair),
    latencyMs,
    stopReason,
    inputTokens: response.usage?.input_tokens,
    outputTokens: response.usage?.output_tokens,
    snapshotHash,
  };

  if (contract) {
    logPremiumAnalysisNormalizedSuccess(diagnosticCtx, normalizedResult.changedFields, raw.length);
  } else {
    logPremiumAnalysisContractFailure(
      diagnosticCtx,
      raw,
      blockType,
      parsed,
      normalized,
      validated,
    );
  }

  return {
    contract,
    raw,
    model,
    latencyMs,
    inputTokens: response.usage?.input_tokens,
    outputTokens: response.usage?.output_tokens,
    stopReason,
  };
}

export async function buildPremiumAnalysisBundle(
  input: BuildPremiumAnalysisBundleInput,
): Promise<PremiumAnalysisBundle> {
  const language = (input.language ?? "en").trim().toLowerCase() || "en";
  const ticker = input.symbol.trim().toUpperCase();
  const deps = resolvePremiumAnalysisOrchestratorDeps(input.deps);
  const snapshot =
    input.snapshotOverride ??
    (await (deps.buildSnapshot ?? buildStockAIDataSnapshot)({
      symbol: ticker,
      prisma: input.prisma,
      includeDividend: true,
      userId: input.userId ?? null,
      plan: input.plan ?? null,
    }));
  const snapshotHash = createSnapshotHash(snapshot);
  const cacheKey = redisKeys.premiumAnalysisBundle(ticker, snapshotHash, language);

  const cachedEntry = await deps.loadCachedEntry(cacheKey);
  if (cachedEntry) {
    logPremiumAnalysisCacheServed({
      symbol: ticker,
      language,
      snapshotHash,
      provider: cachedEntry.provider,
      sourceCacheStatus: cachedEntry.sourceCacheStatus,
    });
    return buildPremiumAnalysisCacheHitBundle(cachedEntry, snapshotHash);
  }

  const lockKey = buildPremiumAnalysisLockKey(ticker, snapshotHash, language);
  const readAfterWait = () => readCachedBundleAfterWaitWithDeps(cacheKey, snapshotHash, deps);

  try {
    return await withSingleFlight(
      lockKey,
      {
        scope: "premium_analysis",
        lockTtlSeconds: PREMIUM_ANALYSIS_SINGLE_FLIGHT_LOCK_TTL_SEC,
        waitMs: PREMIUM_ANALYSIS_SINGLE_FLIGHT_WAIT_MS,
        maxWaitMs: PREMIUM_ANALYSIS_SINGLE_FLIGHT_MAX_WAIT_MS,
        readAfterWait,
      },
      () =>
        runPremiumAnalysisFreshGeneration({
          snapshot,
          snapshotHash,
          cacheKey,
          language,
          plan: input.plan,
          userId: input.userId,
          clientIp: input.clientIp,
          accessState: input.accessState,
          canUseProduct: input.canUseProduct,
          telemetry: input.telemetry,
          deps: input.deps,
        }),
    );
  } catch (error) {
    if (error instanceof SingleFlightTimeoutError) {
      const lateHit = await readCachedBundleAfterWaitWithDeps(cacheKey, snapshotHash, deps);
      if (lateHit) return lateHit;
      return buildPremiumAnalysisSingleFlightTimeoutBundle(snapshot, snapshotHash);
    }
    throw error;
  }
}
