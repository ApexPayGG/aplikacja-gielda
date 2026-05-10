import Anthropic from "@anthropic-ai/sdk";
import process from "node:process";
import { getMarketRegime } from "../../marketRegime";

const MODEL = "claude-sonnet-4-20250514";

export type PreMortemInput = {
  symbol: string;
  entry: number;
  stopLoss: number;
  takeProfit: number;
  quantity: number;
  userId: string;
};

export type PreMortemResult = {
  scenario: string;
  probability: number;
  maxLoss: number;
  marketRegime: string;
};

function clampProbability(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function parseClaudeJson(raw: string): { scenario: string; probability: number } {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  const payload = jsonMatch ? jsonMatch[0] : raw;
  const parsed = JSON.parse(payload) as { scenario?: unknown; probability?: unknown };
  return {
    scenario: String(parsed.scenario ?? "").trim() || "Most likely downside scenario could not be generated.",
    probability: clampProbability(parsed.probability),
  };
}

export async function analyzePreMortem(input: PreMortemInput): Promise<PreMortemResult> {
  const symbol = input.symbol.trim().toUpperCase();
  const market = await getMarketRegime(symbol);
  const marketRegime = market.regime;
  const maxLoss = Number(((input.entry - input.stopLoss) * input.quantity).toFixed(2));

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. Pre-Mortem analysis requires Claude.");
  }

  const prompt =
    "You are a risk analyst. Given this planned trade, describe the single most " +
    "likely loss scenario in 2 sentences max. Then give probability (%).\n" +
    "Return JSON only: { scenario: string, probability: number, maxLoss: number }\n" +
    `Trade: symbol=${symbol}, entry=${input.entry}, stopLoss=${input.stopLoss}, ` +
    `takeProfit=${input.takeProfit}, quantity=${input.quantity}, marketRegime=${marketRegime}`;

  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 220,
    messages: [{ role: "user", content: prompt }],
  });

  const block = msg.content[0];
  const text = block?.type === "text" ? block.text : "";
  const parsed = parseClaudeJson(text);

  return {
    scenario: parsed.scenario,
    probability: parsed.probability,
    maxLoss,
    marketRegime,
  };
}
