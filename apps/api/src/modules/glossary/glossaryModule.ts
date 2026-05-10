import Anthropic from "@anthropic-ai/sdk";
import process from "node:process";
import { getCacheRedis } from "../../redis";

const GLOSSARY_MODEL = "claude-sonnet-4-20250514";
const GLOSSARY_TTL_SECONDS = 24 * 60 * 60;

export type GlossaryExplainResult = {
  term: string;
  explanation: string;
  example: string;
  cached: boolean;
};

type GlossaryPayload = {
  term: string;
  explanation: string;
  example: string;
};

function normalizeLang(langInput: string | undefined): string {
  const lang = String(langInput ?? "en").trim().toLowerCase();
  return lang || "en";
}

function normalizeTerm(termInput: string): { raw: string; cachePart: string } {
  const raw = String(termInput ?? "").trim();
  const cachePart = raw.toLowerCase();
  return { raw, cachePart };
}

function toWordLimited(text: string, maxWords: number): string {
  const words = text
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .filter(Boolean);
  if (words.length <= maxWords) return words.join(" ");
  return words.slice(0, maxWords).join(" ");
}

function parseClaudeJson(text: string): GlossaryPayload {
  const match = text.match(/\{[\s\S]*\}/);
  const jsonText = match ? match[0] : text;
  const parsed = JSON.parse(jsonText) as Partial<GlossaryPayload>;

  return {
    term: String(parsed.term ?? "").trim(),
    explanation: toWordLimited(String(parsed.explanation ?? "").trim(), 30),
    example: toWordLimited(String(parsed.example ?? "").trim(), 20),
  };
}

async function askClaude(term: string): Promise<GlossaryPayload> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. Glossary explain requires Claude.");
  }

  const prompt = `Explain the financial term '${term}' in simple language for a retail investor.
Return JSON: { term, explanation (max 30 words), example (max 20 words) }`;

  const client = new Anthropic({ apiKey });
  const response = await client.messages.create({
    model: GLOSSARY_MODEL,
    max_tokens: 220,
    messages: [{ role: "user", content: prompt }],
  });

  const content = response.content[0];
  const text = content?.type === "text" ? content.text : "";
  const parsed = parseClaudeJson(text);

  return {
    term: parsed.term || term,
    explanation: parsed.explanation,
    example: parsed.example,
  };
}

export async function explainGlossaryTerm(termInput: string, langInput?: string): Promise<GlossaryExplainResult> {
  const { raw: term, cachePart } = normalizeTerm(termInput);
  if (!term) {
    throw new Error("Missing term");
  }

  const lang = normalizeLang(langInput);
  const cacheKey = `glossary:${cachePart}:${lang}`;

  if (process.env.REDIS_URL?.trim()) {
    try {
      const redis = getCacheRedis();
      const cachedRaw = await redis.get(cacheKey);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as GlossaryPayload;
        return {
          term: String(cached.term ?? term),
          explanation: String(cached.explanation ?? ""),
          example: String(cached.example ?? ""),
          cached: true,
        };
      }
    } catch {
      // Ignore cache read issues and continue with live generation.
    }
  }

  const generated = await askClaude(term);

  if (process.env.REDIS_URL?.trim()) {
    try {
      const redis = getCacheRedis();
      await redis.set(
        cacheKey,
        JSON.stringify({
          term: generated.term,
          explanation: generated.explanation,
          example: generated.example,
        }),
        "EX",
        GLOSSARY_TTL_SECONDS,
      );
    } catch {
      // Ignore cache write issues.
    }
  }

  return {
    term: generated.term,
    explanation: generated.explanation,
    example: generated.example,
    cached: false,
  };
}
