import Anthropic from "@anthropic-ai/sdk";
import process from "node:process";
import {
  type AiCallTelemetry,
  logAiCallFromAnthropicResponse,
} from "../../services/aiCostTelemetry";

type StoryInput = {
  ticker: string;
  verdictLabel: string;
  verdictScore: number;
  currentPrice: number;
  target12m: number;
  stopLoss: number;
  horizonMonths: number;
  language: string;
  complexity: string;
};

type CatchInput = {
  ticker: string;
  dirtyTruth: string | null;
  bullSummary: string;
  bearSummary: string;
  premortemContext: string;
};

const STORY_MODEL = "claude-sonnet-4-6";
const CATCH_MODEL = "claude-sonnet-4-6";

function parseJsonObject(raw: string): Record<string, unknown> | null {
  const text = String(raw ?? "").trim();
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function sanitizeSentence(text: unknown, fallback: string): string {
  const raw = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!raw) return fallback;
  return raw.length <= 700 ? raw : `${raw.slice(0, 697)}...`;
}

function hasApiKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
}

async function callClaude(
  prompt: string,
  model: string,
  maxTokens: number,
  telemetry: AiCallTelemetry,
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) return null;
  const startedAt = Date.now();
  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    temperature: 0.2,
    messages: [{ role: "user", content: prompt }],
  });
  logAiCallFromAnthropicResponse(telemetry, model, startedAt, response.usage);
  const block = response.content[0];
  if (!block || block.type !== "text") return null;
  return block.text;
}

export async function generateCinematicStoryAi(
  input: StoryInput,
  telemetry?: Partial<AiCallTelemetry>,
): Promise<{
  act1Narrative?: string;
  act2Narrative?: string;
  act3Narrative?: string;
  synthesis?: string;
}> {
  if (!hasApiKey()) return {};
  const prompt = `You are a senior equity analyst and storyteller.
Return strict JSON only with keys: act1Narrative, act2Narrative, act3Narrative, synthesis.

Ticker: ${input.ticker}
Verdict: ${input.verdictLabel} (${input.verdictScore}/100)
Current price: ${input.currentPrice}
12m target: ${input.target12m}
Stop loss: ${input.stopLoss}
Horizon months: ${input.horizonMonths}
Language: ${input.language}
Complexity level: ${input.complexity}

Rules:
- Write concise but vivid narratives (2-4 sentences each)
- No markdown
- No financial advice disclaimer
- Act1: past decade and strategic inflection points
- Act2: current state, valuation tension, momentum
- Act3: future scenarios framing (bull/base/bear catalyst map)
- Synthesis: one strategic takeaway sentence
`;
  const raw = await callClaude(prompt, STORY_MODEL, 900, {
    endpoint: telemetry?.endpoint ?? "/api/premium/story",
    plan: telemetry?.plan ?? "unknown",
    symbol: telemetry?.symbol ?? input.ticker,
    lang: telemetry?.lang ?? input.language,
    userId: telemetry?.userId ?? null,
    cacheHit: false,
    ...telemetry,
  });
  if (!raw) return {};
  const obj = parseJsonObject(raw);
  if (!obj) return {};
  return {
    act1Narrative: sanitizeSentence(obj.act1Narrative, ""),
    act2Narrative: sanitizeSentence(obj.act2Narrative, ""),
    act3Narrative: sanitizeSentence(obj.act3Narrative, ""),
    synthesis: sanitizeSentence(obj.synthesis, ""),
  };
}

export async function generateCatchAi(
  input: CatchInput,
  telemetry?: Partial<AiCallTelemetry>,
): Promise<{
  dirtyTruthRefinement?: string;
  bullRefinement?: string;
  bearRefinement?: string;
  premortem?: string;
}> {
  if (!hasApiKey()) return {};
  const prompt = `You are a skeptical hedge-fund risk reviewer.
Return strict JSON only with keys: dirtyTruthRefinement, bullRefinement, bearRefinement, premortem.

Ticker: ${input.ticker}
Current dirty truth candidate: ${input.dirtyTruth ?? "none"}
Bull summary: ${input.bullSummary}
Bear summary: ${input.bearSummary}
Premortem context: ${input.premortemContext}

Rules:
- Tight and specific language
- Mention one concrete risk trigger in premortem
- Keep each field max 35 words
- If dirty truth is "none", propose one only if conviction is high; otherwise return empty string
`;
  const raw = await callClaude(prompt, CATCH_MODEL, 450, {
    endpoint: telemetry?.endpoint ?? "/api/premium/catch",
    plan: telemetry?.plan ?? "unknown",
    symbol: telemetry?.symbol ?? input.ticker,
    lang: telemetry?.lang ?? null,
    userId: telemetry?.userId ?? null,
    cacheHit: false,
    ...telemetry,
  });
  if (!raw) return {};
  const obj = parseJsonObject(raw);
  if (!obj) return {};
  return {
    dirtyTruthRefinement: sanitizeSentence(obj.dirtyTruthRefinement, ""),
    bullRefinement: sanitizeSentence(obj.bullRefinement, ""),
    bearRefinement: sanitizeSentence(obj.bearRefinement, ""),
    premortem: sanitizeSentence(obj.premortem, ""),
  };
}
