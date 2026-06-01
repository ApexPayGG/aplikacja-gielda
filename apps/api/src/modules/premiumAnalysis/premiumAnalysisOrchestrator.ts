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
import {
  buildStockAIDataSnapshot,
  createSnapshotHash,
  STOCK_AI_DATA_SNAPSHOT_VERSION,
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
import { resolvePremiumAnalysisModel } from "./premiumAnalysisModelTasks";

const ANALYSIS_MAX_TOKENS = 4096;
const ANALYSIS_TEMPERATURE = 0.2;

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

function formatZodSummary(error: import("zod").ZodError): string {
  return error.issues
    .slice(0, 12)
    .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
    .join("; ");
}

function hasAnthropicKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
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

async function callAnthropicForContract(
  snapshot: Awaited<ReturnType<typeof buildStockAIDataSnapshot>>,
  language: string,
  repair?: { validationSummary: string; priorRaw: string },
  telemetry?: Partial<AiCallTelemetry>,
): Promise<{
  contract: PremiumAnalysisContract | null;
  raw: string;
  model: string;
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
}> {
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
  const raw = block && block.type === "text" ? block.text : "";
  const parsed = parseJsonObject(raw);
  const validated = parsed != null ? validatePremiumAnalysisContract(parsed) : null;
  const contract = validated?.success ? validated.data : null;

  return {
    contract,
    raw,
    model,
    latencyMs: Date.now() - startedAt,
    inputTokens: response.usage?.input_tokens,
    outputTokens: response.usage?.output_tokens,
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
    return {
      contract: cached,
      snapshotHash,
      snapshotVersion: STOCK_AI_DATA_SNAPSHOT_VERSION,
      generatedAt: cached.generatedAt,
      cacheStatus: "hit",
      provider: { name: "anthropic", model: null },
    };
  }

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

    try {
      const first = await callAnthropicForContract(snapshot, language, undefined, input.telemetry);
      contract = first.contract;
      provider = {
        name: "anthropic",
        model: first.model,
        latencyMs: first.latencyMs,
        inputTokens: first.inputTokens,
        outputTokens: first.outputTokens,
        retryCount: 0,
      };

      if (!contract) {
        const validationSummary = "JSON parse failed or schema validation failed on first attempt.";
        retryCount = 1;
        const second = await callAnthropicForContract(
          snapshot,
          language,
          { validationSummary, priorRaw: first.raw || "{}" },
          input.telemetry,
        );
        contract = second.contract;
        provider = {
          name: contract ? "anthropic" : "fallback",
          model: second.model,
          latencyMs: (provider.latencyMs ?? 0) + second.latencyMs,
          inputTokens: (provider.inputTokens ?? 0) + (second.inputTokens ?? 0),
          outputTokens: (provider.outputTokens ?? 0) + (second.outputTokens ?? 0),
          retryCount: 1,
        };
      }
    } catch (error) {
      if (error instanceof PremiumAnalysisUsageLimitExceededError) throw error;
      contract = null;
      provider = { name: "fallback", model: null, retryCount };
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
    provider = { name: "fallback", model: null, retryCount };
  } else {
    const check = validatePremiumAnalysisContract(contract);
    if (!check.success) {
      contract = buildFallbackPremiumAnalysisContract(snapshot);
      cacheStatus = "fallback";
      provider = { name: "fallback", model: provider.model, retryCount };
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
