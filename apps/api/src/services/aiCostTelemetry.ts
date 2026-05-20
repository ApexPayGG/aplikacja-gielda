import process from "node:process";

/** Structured AI usage log for margin monitoring (stdout JSON). */
export type AiUsageEvent = {
  userId: string | null;
  plan: string;
  endpoint: string;
  symbol: string | null;
  lang: string | null;
  cacheHit: boolean;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  latencyMs: number;
  createdAt: string;
  meta?: Record<string, string | number | boolean>;
};

const SONNET_INPUT_PER_M = 3;
const SONNET_OUTPUT_PER_M = 15;
const HAIKU_INPUT_PER_M = 0.8;
const HAIKU_OUTPUT_PER_M = 4;

export function estimateAnthropicCostUsd(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const m = model.toLowerCase();
  const isHaiku = m.includes("haiku");
  const inRate = (isHaiku ? HAIKU_INPUT_PER_M : SONNET_INPUT_PER_M) / 1_000_000;
  const outRate = (isHaiku ? HAIKU_OUTPUT_PER_M : SONNET_OUTPUT_PER_M) / 1_000_000;
  return inputTokens * inRate + outputTokens * outRate;
}

export function logAiUsageEvent(event: AiUsageEvent): void {
  if (process.env.AI_USAGE_LOG_DISABLED === "1") return;
  const line = JSON.stringify({ type: "ai_usage", ...event });
  console.info(line);
}

export type AiCallTelemetry = {
  userId?: string | null;
  plan?: string;
  endpoint: string;
  symbol?: string | null;
  lang?: string | null;
  cacheHit?: boolean;
  meta?: Record<string, string | number | boolean>;
};

export function logAiCallFromAnthropicResponse(
  telemetry: AiCallTelemetry,
  model: string,
  startedAtMs: number,
  usage?: { input_tokens?: number; output_tokens?: number } | null,
): void {
  const inputTokens = usage?.input_tokens ?? null;
  const outputTokens = usage?.output_tokens ?? null;
  const estimatedCostUsd =
    inputTokens != null && outputTokens != null
      ? estimateAnthropicCostUsd(model, inputTokens, outputTokens)
      : null;

  logAiUsageEvent({
    userId: telemetry.userId ?? null,
    plan: telemetry.plan ?? "unknown",
    endpoint: telemetry.endpoint,
    symbol: telemetry.symbol ?? null,
    lang: telemetry.lang ?? null,
    cacheHit: telemetry.cacheHit ?? false,
    model,
    inputTokens,
    outputTokens,
    estimatedCostUsd,
    latencyMs: Date.now() - startedAtMs,
    createdAt: new Date().toISOString(),
    meta: telemetry.meta,
  });
}
