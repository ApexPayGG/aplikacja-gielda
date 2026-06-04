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
import { enforcePremiumAnalysisDailyLimit } from "../../services/premiumAnalysisUsageLimit";
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

export type PremiumAnalysisProviderMeta = {
  name: "anthropic" | "fallback";
  model: string | null;
  latencyMs?: number;
  inputTokens?: number;
  outputTokens?: number;
  retryCount?: number;
};

export type PremiumAnalysisBundle = {
  contract: PremiumAnalysisContract;
  snapshotHash: string;
  snapshotVersion: string;
  generatedAt: string;
  cacheStatus: PremiumAnalysisCacheStatus;
  provider: PremiumAnalysisProviderMeta;
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
  | "premium_analysis_llm_validation_failed";

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

function logPremiumAnalysisContractFailure(
  ctx: PremiumAnalysisLlmCallContext,
  raw: string,
  blockType: string | undefined,
  parsed: unknown,
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

export function readValidatedPremiumAnalysisCache(
  cached: unknown,
): PremiumAnalysisContract | null {
  const result = validatePremiumAnalysisContract(cached);
  return result.success ? result.data : null;
}

async function loadCachedContract(
  cacheKey: string,
): Promise<PremiumAnalysisContract | null> {
  const cached = await cacheJsonGet<unknown>(cacheKey);
  if (cached == null) return null;
  return readValidatedPremiumAnalysisCache(cached);
}

function buildPremiumAnalysisCacheHitBundle(
  cached: PremiumAnalysisContract,
  snapshotHash: string,
): PremiumAnalysisBundle {
  return {
    contract: cached,
    snapshotHash,
    snapshotVersion: STOCK_AI_DATA_SNAPSHOT_VERSION,
    generatedAt: cached.generatedAt,
    cacheStatus: "hit",
    provider: { name: "anthropic", model: null },
  };
}

async function readCachedBundleAfterWait(
  cacheKey: string,
  snapshotHash: string,
): Promise<PremiumAnalysisBundle | null> {
  const cached = await loadCachedContract(cacheKey);
  if (!cached) return null;
  return buildPremiumAnalysisCacheHitBundle(cached, snapshotHash);
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
};

async function runPremiumAnalysisFreshGeneration(
  input: RunPremiumAnalysisFreshGenerationInput,
): Promise<PremiumAnalysisBundle> {
  const { snapshot, snapshotHash, cacheKey, language } = input;

  const leaderCacheHit = await readCachedBundleAfterWait(cacheKey, snapshotHash);
  if (leaderCacheHit) return leaderCacheHit;

  let retryCount = 0;
  let provider: PremiumAnalysisProviderMeta = {
    name: "fallback",
    model: null,
  };
  let contract: PremiumAnalysisContract | null = null;

  if (hasAnthropicKey()) {
    const usage = await enforcePremiumAnalysisDailyLimit({
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

    const anthropicStartedAt = Date.now();
    try {
      const first = await callAnthropicForContract(
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
        const second = await callAnthropicForContract(
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

  await cacheJsonSet(cacheKey, contract, REDIS_TTL_SEC.PREMIUM_ANALYSIS_BUNDLE);

  return {
    contract,
    snapshotHash,
    snapshotVersion: STOCK_AI_DATA_SNAPSHOT_VERSION,
    generatedAt: contract.generatedAt,
    cacheStatus,
    provider,
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
  const validated = parsed != null ? validatePremiumAnalysisContract(parsed) : null;
  const contract = validated?.success ? validated.data : null;

  const stopReason =
    "stop_reason" in response && typeof response.stop_reason === "string"
      ? response.stop_reason
      : null;

  const latencyMs = Date.now() - startedAt;
  if (!contract) {
    logPremiumAnalysisContractFailure(
      {
        symbol: telemetry?.symbol ?? snapshot.symbol,
        language,
        model,
        repair: Boolean(repair),
        latencyMs,
        stopReason,
        inputTokens: response.usage?.input_tokens,
        outputTokens: response.usage?.output_tokens,
        snapshotHash,
      },
      raw,
      blockType,
      parsed,
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
  const snapshot = await buildStockAIDataSnapshot({
    symbol: ticker,
    prisma: input.prisma,
    includeDividend: true,
    userId: input.userId ?? null,
    plan: input.plan ?? null,
  });
  const snapshotHash = createSnapshotHash(snapshot);
  const cacheKey = redisKeys.premiumAnalysisBundle(ticker, snapshotHash, language);

  const cached = await loadCachedContract(cacheKey);
  if (cached) {
    return buildPremiumAnalysisCacheHitBundle(cached, snapshotHash);
  }

  const lockKey = buildPremiumAnalysisLockKey(ticker, snapshotHash, language);
  const readAfterWait = () => readCachedBundleAfterWait(cacheKey, snapshotHash);

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
        }),
    );
  } catch (error) {
    if (error instanceof SingleFlightTimeoutError) {
      const lateHit = await readCachedBundleAfterWait(cacheKey, snapshotHash);
      if (lateHit) return lateHit;
      return buildPremiumAnalysisSingleFlightTimeoutBundle(snapshot, snapshotHash);
    }
    throw error;
  }
}
